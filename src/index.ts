import type { Plugin, ViteDevServer, ModuleNode } from "vite";
import MagicString from "magic-string";

/**
 * vite-plugin-lit-hmr
 *
 * Makes Lit elements work with HMR by solving the fundamental problem:
 * `customElements.define()` can only be called ONCE per tag name.
 *
 * Strategy:
 * 1. Intercept `customElements.define('my-el', MyEl)` and replace with a
 *    proxy-based registration that can swap the underlying class on HMR.
 * 2. Maintain a registry mapping original tag names → latest class + version.
 * 3. On HMR update, the new class is hot-swapped into the proxy, and existing
 *    DOM instances are "upgraded" by re-running lifecycle/rendering.
 * 4. Consumer files that use `<my-el>` in Lit `html` templates don't need to
 *    change — the tag name is stable, but the backing class is swapped.
 *
 * This avoids the "versioned tag name" approach (my-el-v1, my-el-v2) which
 * breaks consumers, and instead uses a proxy class registered once that
 * delegates to the latest real class.
 */

interface PluginOptions {
  /**
   * File patterns to include (glob or regex). Defaults to files containing
   * customElements.define or @customElement.
   */
  include?: string | RegExp | (string | RegExp)[];
  /**
   * File patterns to exclude.
   */
  exclude?: string | RegExp | (string | RegExp)[];
}

// Regex to detect customElements.define('tag-name', ClassName)
const DEFINE_RE =
  /customElements\.define\(\s*(['"`])([^'"`]+)\1\s*,\s*([a-zA-Z_$][\w$]*)\s*\)/g;

// Regex to detect @customElement('tag-name') decorator
const DECORATOR_RE =
  /@customElement\(\s*(['"`])([^'"`]+)\1\s*\)/g;

function isLitFile(code: string): boolean {
  return (
    DEFINE_RE.test(code) ||
    DECORATOR_RE.test(code) ||
    code.includes("from 'lit'") ||
    code.includes('from "lit"') ||
    code.includes("from 'lit/")
  );
}

export function litHmr(options: PluginOptions = {}): Plugin {
  let server: ViteDevServer;

  /**
   * The HMR runtime code injected into the client.
   * This maintains the registry and handles hot-swapping.
   */
  const HMR_RUNTIME = (propsAndState: Array<{ type: "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function"; name: string; value: unknown }>) => `
    window.__LIT_HMR_REGISTRY__ ??= new Map();
    window.__propsAndState__ = ${JSON.stringify(propsAndState)};

    /**
     * Register or update a Lit element.
     * On first call: creates a proxy class and registers it with customElements.
     * On subsequent calls: swaps the underlying class and re-renders instances.
     */
    window.__litHmrDefine ??= function(tagName, ElementClass, moduleUrl, deps) {
      const registry = window.__LIT_HMR_REGISTRY__;
      const existing = registry.get(tagName);

      if (!existing) {
        // The proxy class extends the FIRST version of the element.
        // On HMR updates, we patch its prototype chain.
        const record = {
          elementClass: ElementClass,
          tagName,
          instances: new Set(),
        }

        class HmrProxyElement extends ElementClass {
          constructor() {
            super();
            record.instances.add(this);
          }

          disconnectedCallback() {
            record.instances.delete(this);
            if (super.disconnectedCallback) {
              super.disconnectedCallback();
            }
          }
        }

        // Store reference to the proxy so we can patch it later
        record.proxyClass = HmrProxyElement;
        registry.set(tagName, record);

        // Register with the real customElements registry — this only happens once
        customElements.define(tagName, HmrProxyElement);
      } else {
        // HMR update: swap the class

        // Re-render all existing instances
        console.log('[lit-hmr] Hot updating <' + tagName + '>', existing.instances.size, 'instances');

        const oldProto = existing.proxyClass.prototype;
        const newProto = ElementClass.prototype;

        // Patch the prototype chain
        for (const key of Reflect.ownKeys(newProto)) {
          if (key === 'constructor') continue;

          const desc = Object.getOwnPropertyDescriptor(newProto, key);

          if (desc.get || desc.set) {
            continue;
          }

          try {
            Object.defineProperty(oldProto, key, desc);
          } catch (err) {
            console.warn('[lit-hmr] Failed to patch', key, err);
          }
        }

        existing.instances.forEach((instance) => {
          // Trigger an update/render if applicable
          if (typeof instance.requestUpdate === 'function') {
            instance.requestUpdate();
          }
        });

        // Update the stored class reference
        console.log('[lit-hmr] Updated class for <' + tagName + '>', existing.elementClass, '→', ElementClass);
        existing.elementClass = ElementClass;
      }
    };
    `;

  return {
    name: "vite-plugin-lit-hmr",
    enforce: "pre",

    configureServer(_server) {
      server = _server;
    },

    transform(code: string, id: string) {
      // Skip node_modules (except for specific packages if needed)
      if (id.includes("node_modules")) return null;

      // Only process files that look like they contain Lit elements
      if (!isLitFile(code)) return null;

      // Reset lastIndex since we test then use the regex
      DEFINE_RE.lastIndex = 0;
      DECORATOR_RE.lastIndex = 0;

      const s = new MagicString(code);
      let hasTransforms = false;
      const tagNames: string[] = [];

      // Extract local (relative) import bindings to pass as deps for HMR
      // This enables patching controller/service instances on existing elements
      const localImports: string[] = [];
      const LOCAL_IMPORT_RE = /import\s+(?!type\b)(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"](\.[^'"]*)['"]/g;
      let importMatch: RegExpExecArray | null;
      while ((importMatch = LOCAL_IMPORT_RE.exec(code)) !== null) {
        const [, defaultImport, namedImports] = importMatch;
        if (defaultImport) localImports.push(defaultImport);
        if (namedImports) {
          for (const binding of namedImports.split(',')) {
            const trimmed = binding.trim();
            if (!trimmed || trimmed.startsWith('type ')) continue;
            const asMatch = trimmed.match(/\S+\s+as\s+(\S+)/);
            localImports.push(asMatch ? asMatch[1] : trimmed);
          }
        }
      }
      const depsArg = localImports.length > 0
        ? `, {${localImports.join(', ')}}`
        : '';

      // Transform customElements.define('tag', Class) calls
      let match: RegExpExecArray | null;
      DEFINE_RE.lastIndex = 0;
      while ((match = DEFINE_RE.exec(code)) !== null) {
        const [fullMatch, _quote, tagName, className] = match;
        const start = match.index;
        const end = start + fullMatch.length;

        tagNames.push(tagName);
        s.overwrite(
          start,
          end,
          `window.__litHmrDefine(${JSON.stringify(tagName)}, ${className}, ${JSON.stringify(id)}${depsArg})`
        );
        hasTransforms = true;
      }

      // Transform @customElement('tag') decorators
      // Strategy: Find the class after the decorator and inject registration code after it
      DECORATOR_RE.lastIndex = 0;
      const decoratorMatches: Array<{ tagName: string; decoratorEnd: number }> = [];

      while ((match = DECORATOR_RE.exec(code)) !== null) {
        const [fullMatch, _quote, tagName] = match;
        const start = match.index;
        const end = start + fullMatch.length;

        tagNames.push(tagName);
        decoratorMatches.push({ tagName, decoratorEnd: end });

        // Remove the decorator
        s.overwrite(start, end, `/* @customElement('${tagName}') removed by lit-hmr */`);
        hasTransforms = true;
      }

      // For each decorator, find the corresponding class and add registration after it
      for (const { tagName, decoratorEnd } of decoratorMatches) {
        // Find the class definition after the decorator
        const afterDecorator = code.slice(decoratorEnd);
        const classMatch = afterDecorator.match(/export\s+class\s+([a-zA-Z_$][\w$]*)/);

        if (classMatch) {
          const className = classMatch[1];
          // Find the end of the class (look for the closing brace at the same indentation level)
          // Simple approach: find the class, then inject code after the entire file is processed
          // We'll append the registration at the end of the transform

          // For now, append registration code after imports
          const registrationCode = `\nwindow.__litHmrDefine(${JSON.stringify(tagName)}, ${className}, ${JSON.stringify(id)}${depsArg});\n`;

          // Find a good insertion point: after the class definition
          // Look for the class definition position
          const classStart = decoratorEnd + afterDecorator.indexOf(classMatch[0]);

          // Find the end of the class by looking for its closing brace
          // This is a simplified approach - find the class body
          const classBodyStart = code.indexOf('{', classStart);
          if (classBodyStart !== -1) {
            let braceCount = 1;
            let pos = classBodyStart + 1;
            while (pos < code.length && braceCount > 0) {
              if (code[pos] === '{') braceCount++;
              if (code[pos] === '}') braceCount--;
              pos++;
            }

            if (braceCount === 0) {
              // Found the end of the class, insert registration after it
              s.appendLeft(pos, registrationCode);
            }
          }
        }
      }

      if (!hasTransforms) return null;

      // Get all properties and state decorator fields and its value to potentially patch
      // Empty line means the end of the code
      const propsAndState: Array<{ type: "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function"; name: string; value: unknown }> = [];
      const PROP_RE = /@property\(\s*(?:\{[^}]*\}\s*)?\)\s*(?:public|private|protected)?\s*(?:accessor\s+)?([a-zA-Z_$][\w$]*)/g;
      const STATE_RE = /@state\(\s*(?:\{[^}]*\}\s*)?\)\s*(?:public|private|protected)?\s*(?:accessor\s+)?([a-zA-Z_$][\w$]*)/g;

      let propMatch: RegExpExecArray | null;
      PROP_RE.lastIndex = 0;
      while ((propMatch = PROP_RE.exec(code)) !== null) {
        const [, propName] = propMatch;
        // get the value, new line or semicolon ends the value
        const valueMatch = code.slice(propMatch.index).match(new RegExp(`@property\\(\\s*(?:\\{[^}]*\\}\\s*)?\\)\\s*(?:public|private|protected)?\\s*(?:accessor\\s+)?${propName}\\s*=\\s*([^;\\n]+)`));
        let value: unknown = undefined;
        if (valueMatch) {
          try {
            value = eval(valueMatch[1]);
          } catch (e) {
            console.warn(`[lit-hmr] Failed to evaluate value for property ${propName}: ${e}`);
          }
        }
        propsAndState.push({ type: typeof value, name: propName, value });
      }

      let stateMatch: RegExpExecArray | null;
      STATE_RE.lastIndex = 0;
      while ((stateMatch = STATE_RE.exec(code)) !== null) {
        const [, stateName] = stateMatch;
        // get the value, new line or semicolon ends the value
        const valueMatch = code.slice(stateMatch.index).match(new RegExp(`@state\\(\\s*(?:\\{[^}]*\\}\\s*)?\\)\\s*(?:public|private|protected)?\\s*(?:accessor\\s+)?${stateName}\\s*=\\s*([^;\\n]+)`));
        let value: unknown = undefined;
        if (valueMatch) {
          try {
            value = eval(valueMatch[1]);
          } catch (e) {
            console.warn(`[lit-hmr] Failed to evaluate value for state ${stateName}: ${e}`);
          }
        }
        propsAndState.push({ type: typeof value, name: stateName, value });
      }

      if (propsAndState.length > 0) {
        console.log(`[lit-hmr] Detected @property/@state fields in ${id}:`, propsAndState);
      }

      // Prepend the HMR runtime (idempotent, checks for existing)
      s.prepend(HMR_RUNTIME(propsAndState) + "\n");

      // Append HMR accept code
      const hmrCode = `
            if (import.meta.hot) {
              import.meta.hot.accept((newModule) => {
                // The new module's top-level code has already run,
                // which called __litHmrDefine with the updated class.
                if (window.__LIT_HMR_NEEDS_RELOAD__) {
                  var reason = window.__LIT_HMR_RELOAD_REASON__;
                  window.__LIT_HMR_NEEDS_RELOAD__ = false;
                  window.__LIT_HMR_RELOAD_REASON__ = '';
                  console.warn('[HMR] invalidate HMR', reason);
                  // import.meta.hot.invalidate(reason);
                } else {
                  console.log('[lit-hmr] Module accepted: ${id}');
                }
              });
            }
      `;

      s.append(hmrCode);

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    },
  };
}

export function litHmrPost(options: PluginOptions = {}): Plugin {
  let server: ViteDevServer;

  // Updating properties and state on existing instances requires patching
  const HMR_POST_RUNTIME = (name: string) => `
    // Patch __privateGet and __privateSet to handle Lit HMR
    function patchPrivateAccessors() {
        const tagName = ${JSON.stringify(name)};
        console.log('[lit-hmr] Patching private accessors for <' + tagName + '>');
        const existing = window.__LIT_HMR_REGISTRY__.get(tagName);
        console.log('[lit-hmr] Found registry entry:', existing);
        if (existing) {
          const proxyClass = existing.proxyClass;
          // Patch the prototype chain
          for (const key of Object.getOwnPropertyNames(existing.elementClass.prototype)) {
            if (key === 'constructor') continue;

            const desc = Object.getOwnPropertyDescriptor(existing.elementClass.prototype, key);
            if (desc.get || desc.set) {
              const propInfo = window.__propsAndState__.find(p => p.name === key);
              if (propInfo) {
                console.log('[lit-hmr] Patching accessor', key, 'type:', propInfo.type, existing.elementClass.prototype[key], '→', propInfo.value);
                existing.instances.forEach((instance) => {
                  // Trigger an update/render if applicable
                  if (typeof instance.requestUpdate === 'function') {
                    // Patch the property value to trigger the setter
                    try {
                      instance[key] = propInfo.value;
                    } catch (e) {
                      console.warn('[lit-hmr] Failed to patch property', key, e);
                    }
                    instance.requestUpdate();
                  }
                });
              }
            }
          }
        }
      }

      patchPrivateAccessors();
  `;

  return {
    name: "vite-plugin-lit-hmr-post",
    enforce: "post",

    configureServer(_server) {
      server = _server;
    },

    transform(code: string, id: string) {
      // Skip node_modules (except for specific packages if needed)
      if (id.includes("node_modules")) return null;

      // Only process files that look like they contain Lit elements
      if (!isLitFile(code)) return null;

      const s = new MagicString(code);
      let hasTransforms = false;
      // Override var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
      // To always return true
      const ACCESS_CHECK_RE = /var\s+__accessCheck\s*=\s*\(obj,\s*member,\s*msg\)\s*=>\s*member\.has\(obj\)\s*\|\|\s*__typeError\("Cannot\s+"\s*\+\s*msg\);/;
      if (ACCESS_CHECK_RE.test(code)) {
        s.overwrite(
          code.match(ACCESS_CHECK_RE)!.index!,
          code.match(ACCESS_CHECK_RE)!.index! + code.match(ACCESS_CHECK_RE)![0].length,
          'var __accessCheck = (obj, member, msg) => true; // patched by lit-hmr'
        );
        hasTransforms = true;
      }


      // Find tag name `window.__litHmrDefine('tag-name', ClassName, ...)` calls to know which elements to patch
      const LIT_HMR_DEFINE_RE = /window\.__litHmrDefine\(\s*(['"`])([^'"`]+)\1\s*,\s*([a-zA-Z_$][\w$]*)\s*,\s*([^,]+)(?:,[^)]+)?\s*\)/g;
      const tagNames: string[] = [];
      let match: RegExpExecArray | null;
      LIT_HMR_DEFINE_RE.lastIndex = 0;
      while ((match = LIT_HMR_DEFINE_RE.exec(code)) !== null) {
        const [, _quote, tagName] = match;
        tagNames.push(tagName);
      }
      
      // Append the post runtime for each tag name
      for (const tagName of tagNames) {
        s.append(HMR_POST_RUNTIME(tagName) + "\n");
        hasTransforms = true;
      }

      if (!hasTransforms) return null;

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    }
  }
}
