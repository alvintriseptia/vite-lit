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

/**
 * The HMR runtime code injected into the client.
 * This maintains the registry and handles hot-swapping.
 */
const HMR_RUNTIME = `
if (!window.__LIT_HMR_REGISTRY__) {
  window.__LIT_HMR_REGISTRY__ = new Map();

  /**
   * Register or update a Lit element.
   * On first call: creates a proxy class and registers it with customElements.
   * On subsequent calls: swaps the underlying class and re-renders instances.
   */
  window.__litHmrDefine = function(tagName, ElementClass, moduleUrl) {
    const registry = window.__LIT_HMR_REGISTRY__;
    const existing = registry.get(tagName);

    if (!existing) {
      // First registration: create a thin wrapper class that delegates to the real one.
      // We register THIS wrapper with customElements — it never changes.
      // But we can swap what "real class" it delegates to.

      const record = {
        currentClass: ElementClass,
        version: 0,
        instances: new Set(),
        moduleUrl: moduleUrl,
      };

      // The proxy class extends the FIRST version of the element.
      // On HMR updates, we patch its prototype chain.
      class HmrProxyElement extends ElementClass {
        constructor() {
          super();
          record.instances.add(this);
        }

        disconnectedCallback() {
          super.disconnectedCallback?.();
          record.instances.delete(this);
        }
      }

      // Store reference to the proxy so we can patch it later
      record.proxyClass = HmrProxyElement;

      registry.set(tagName, record);

      // Register with the real customElements registry — this only happens once
      customElements.define(tagName, HmrProxyElement);
    } else {
      // HMR update: swap the class
      existing.version++;
      const OldClass = existing.currentClass;
      existing.currentClass = ElementClass;
      existing.moduleUrl = moduleUrl;

      const ProxyClass = existing.proxyClass;

      // Patch the prototype chain:
      // Copy all new prototype methods/properties onto the proxy prototype
      const newProto = ElementClass.prototype;
      const proxyProto = ProxyClass.prototype;

      // Get all property names from new class prototype
      const newKeys = new Set([
        ...Object.getOwnPropertyNames(newProto),
        ...Object.getOwnPropertySymbols(newProto),
      ]);

      // Get old keys to detect removed methods
      const oldKeys = new Set([
        ...Object.getOwnPropertyNames(proxyProto),
        ...Object.getOwnPropertySymbols(proxyProto),
      ]);

      // Copy new/updated properties
      for (const key of newKeys) {
        if (key === 'constructor') continue;
        const descriptor = Object.getOwnPropertyDescriptor(newProto, key);
        if (descriptor) {
          Object.defineProperty(proxyProto, key, descriptor);
        }
      }

      // Copy static properties (styles, properties, etc.)
      const staticKeys = [
        ...Object.getOwnPropertyNames(ElementClass),
        ...Object.getOwnPropertySymbols(ElementClass),
      ];
      for (const key of staticKeys) {
        if (['prototype', 'length', 'name'].includes(key)) continue;
        try {
          const descriptor = Object.getOwnPropertyDescriptor(ElementClass, key);
          if (descriptor) {
            Object.defineProperty(ProxyClass, key, descriptor);
          }
        } catch (e) {
          // Some static properties may not be configurable
        }
      }

      // Critical: update Lit's internal static caches
      // Lit caches 'styles' and 'elementProperties' as finalized statics.
      // We need to bust these caches so Lit re-evaluates them.
      if (ElementClass.elementProperties) {
        ProxyClass.elementProperties = ElementClass.elementProperties;
      }

      // Force Lit to re-finalize by clearing the finalized flag
      // Lit uses a private static __finalized or similar — we reset it
      // by deleting known cache keys
      delete ProxyClass._$litElement$;
      delete ProxyClass['finalized'];

      // Adopt-sheet the new styles
      if (ElementClass.styles !== undefined) {
        ProxyClass.styles = ElementClass.styles;
      }

      // Re-render all existing instances
      console.log(
        '[lit-hmr] Hot updating <' + tagName + '> (v' + existing.version + ', ' +
        existing.instances.size + ' instance(s))'
      );

      for (const instance of existing.instances) {
        try {
          // Update the instance's adopted stylesheets if shadow root exists
          if (instance.renderRoot && instance.renderRoot.adoptedStyleSheets) {
            // Let Lit handle re-adopting styles on next render
          }

          // Force Lit to re-render
          instance.requestUpdate();
        } catch (e) {
          console.warn('[lit-hmr] Error updating instance of <' + tagName + '>:', e);
        }
      }
    }
  };
}
`;

export default function litHmr(options: PluginOptions = {}): Plugin {
  let server: ViteDevServer;

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
          `window.__litHmrDefine(${JSON.stringify(tagName)}, ${className}, ${JSON.stringify(id)})`
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
          const registrationCode = `\nwindow.__litHmrDefine(${JSON.stringify(tagName)}, ${className}, ${JSON.stringify(id)});\n`;

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

      // Prepend the HMR runtime (idempotent, checks for existing)
      s.prepend(HMR_RUNTIME + "\n");

      // Append HMR accept code
      const hmrCode = `
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // The new module's top-level code has already run,
    // which called __litHmrDefine with the updated class.
    // That function handles re-rendering existing instances.
    // So we don't need to do anything extra here!
    console.log('[lit-hmr] Module accepted: ${id}');
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

export { litHmr };
