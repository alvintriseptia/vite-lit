# vite-plugin-lit-hmr

Hot Module Replacement for Lit custom elements in Vite.

## The Problem

Custom elements have a fundamental constraint: `customElements.define('my-el', MyClass)` can only be called **once** per tag name. Calling it again throws an error. This makes traditional HMR impossible — you can't re-register a tag with an updated class.

### Why Query Params / Versioned Tags Don't Work

You might think: "Just version the tag name — `my-el-v1`, `my-el-v2`..." but this breaks **consumer files**:

```js
// consumer.js — uses the element in a template
html`<my-el .data=${this.data}></my-el>`
```

When `my-el.js` hot-updates, `consumer.js` still references `<my-el>` (the old version). You'd need to:
1. Track every file that imports `my-el.js`
2. Rewrite their templates to use `<my-el-v2>`
3. Force those files to HMR-update too (cascading updates)

This is fragile and defeats the purpose of HMR.

## The Solution: Proxy Class Registration

Instead of versioning tag names, we register a **proxy class** once and swap its internals on HMR:

```
First load:
  customElements.define('my-el', ProxyClass)  ← registered once, never changes
  ProxyClass delegates to → RealClass_v0

HMR update:
  ProxyClass delegates to → RealClass_v1      ← swapped, same tag name
  All existing <my-el> instances → re-render
```

### How Consumer Files Stay Current

**This is the key insight: consumer files don't need to change at all.**

```js
// my-counter.js — defines the element
@customElement('my-counter')
class MyCounter extends LitElement {
  render() { return html`<p>Count: ${this.count}</p>`; }
}

// app.js — consumes the element
class MyApp extends LitElement {
  render() {
    return html`<my-counter .count=${this.count}></my-counter>`;
  }
}
```

When `my-counter.js` is edited:
1. The plugin's transform has replaced `customElements.define` with `__litHmrDefine`
2. `__litHmrDefine` updates the proxy class's prototype with the new `render()`, styles, etc.
3. It calls `requestUpdate()` on every existing `<my-counter>` instance
4. **`app.js` doesn't need to know anything changed** — it still references `<my-counter>`, which is still the same proxy class in the registry. The proxy just delegates differently now.

It works because HTML custom elements are resolved by **tag name at render time**, not by class reference at import time. When Lit's `html` template creates `<my-counter>`, the browser looks up `my-counter` in the custom elements registry — and finds the same proxy class, which now has updated behavior.

## Setup

```js
// vite.config.js
import { defineConfig } from 'vite';
import litHmr from 'vite-plugin-lit-hmr';

export default defineConfig({
  plugins: [litHmr()],
});
```

## How It Works (Detailed)

### 1. Transform Phase (Build Time)

The plugin transforms your source code:

**Before:**
```js
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('my-counter')
class MyCounter extends LitElement {
  @property({ type: Number }) count = 0;

  static styles = css`p { color: blue; }`;

  render() {
    return html`<p>Count: ${this.count}</p>`;
  }
}
```

**After (in dev mode):**
```js
// HMR runtime injected (idempotent)
if (!window.__LIT_HMR_REGISTRY__) {
  window.__LIT_HMR_REGISTRY__ = new Map();
  window.__litHmrDefine = function(tagName, ElementClass, moduleUrl) {
    // ... proxy registration / swap logic
  };
}

import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';

// Decorator replaced with HMR-aware registration
((tagName) => (cls) => {
  window.__litHmrDefine(tagName, cls, '/src/my-counter.ts');
  return cls;
})('my-counter')
class MyCounter extends LitElement {
  @property({ type: Number }) count = 0;

  static styles = css`p { color: blue; }`;

  render() {
    return html`<p>Count: ${this.count}</p>`;
  }
}

// HMR acceptance
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // Module re-execution already called __litHmrDefine
    // which handled the swap + re-render
  });
}
```

### 2. First Registration (Runtime)

When `__litHmrDefine('my-counter', MyCounter)` is called the first time:

1. Creates a `HmrProxyElement` class that extends `MyCounter`
2. Registers `HmrProxyElement` with `customElements.define('my-counter', ...)`
3. Stores the mapping: `'my-counter' → { currentClass: MyCounter, proxyClass: HmrProxyElement, instances: Set }`
4. Proxy tracks all created instances via constructor/disconnectedCallback

### 3. HMR Update (Runtime)

When you edit `my-counter.ts` and save:

1. Vite detects the change and sends an HMR update
2. The module re-executes — `__litHmrDefine('my-counter', MyCounter_v2)` is called
3. Since `'my-counter'` already exists in the registry:
   - Copies all prototype methods from `MyCounter_v2` onto `HmrProxyElement.prototype`
   - Copies static properties (styles, elementProperties, etc.)
   - Busts Lit's internal finalization caches
   - Calls `requestUpdate()` on every tracked instance
4. All `<my-counter>` elements on the page re-render with the new template/styles

### 4. Why Consumer Files Just Work

```js
// app-shell.js
class AppShell extends LitElement {
  render() {
    // This template creates <my-counter> by TAG NAME.
    // The browser resolves 'my-counter' → HmrProxyElement (the proxy)
    // The proxy's prototype has been patched to use the latest render(),
    // styles, and properties.
    return html`
      <h1>My App</h1>
      <my-counter .count=${42}></my-counter>
    `;
  }
}
```

Even if `app-shell.js` never re-executes:
- Existing `<my-counter>` instances are re-rendered via `requestUpdate()`
- New `<my-counter>` instances created by the template use the patched proxy class
- **No import graph traversal needed for consumers**

## What Gets Hot-Updated

| Change | HMR? | Notes |
|--------|------|-------|
| `render()` method | ✅ | Template re-renders immediately |
| `static styles` | ✅ | Adopted stylesheets updated |
| Methods / event handlers | ✅ | Prototype patched |
| `@property` declarations | ⚠️ | New properties work; removed properties may leave stale state |
| Constructor logic | ⚠️ | Only affects newly created instances |
| Tag name change | ❌ | Full reload required |
| Superclass change | ❌ | Full reload required |

## Limitations

1. **Constructor changes**: The proxy class's constructor ran the original class's constructor. Existing instances won't re-run the new constructor. New instances will.

2. **Property removal**: If you remove a `@property`, existing instances keep the old property. Usually not a problem during development.

3. **Adopted stylesheets**: Lit's style adoption is cached internally. The plugin busts known caches, but deeply nested style composition may occasionally need a manual reload.

4. **Mixins and superclasses**: If you change a mixin or base class that multiple elements inherit from, each element file needs its own HMR update. The plugin only patches direct registrations.

## License

MIT
