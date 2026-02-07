# Lit HMR Demo

This is a demo application to test the **vite-plugin-lit-hmr** plugin.

## Features

This demo includes:
- `my-element`: The default Vite + Lit counter component
- `counter-element`: A custom counter component specifically designed to test HMR

## How to Test HMR

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open your browser** and navigate to the local server (usually `http://localhost:5173`)

3. **Interact with the counters:**
   - Click the buttons to increment the counter values
   - Notice the state is preserved in the component instances

4. **Test Hot Module Replacement:**

   **Test 1: Edit Styles**
   - Open `src/counter-element.ts`
   - Change the colors in the `static styles` (e.g., change `#646cff` to `#ff6464`)
   - Save the file
   - ✅ The styles should update instantly WITHOUT losing the counter state!

   **Test 2: Edit Template**
   - Change the text "HMR Test Counter" to something else
   - Save the file
   - ✅ The text should update instantly WITHOUT resetting the counters!

   **Test 3: Edit Behavior**
   - Change the `_increment()` method to increment by 2 instead of 1
   - Save the file
   - Click the + button
   - ✅ The behavior should update WITHOUT losing current counter values!

   **Test 4: Multiple Instances**
   - Notice there are TWO `<counter-element>` instances in the HTML
   - Set different counter values on each
   - Edit the component file
   - ✅ BOTH instances should update while preserving their individual states!

## What to Observe

When HMR works correctly:
- 🎯 Console shows: `[lit-hmr] Hot updating <counter-element> (vX, Y instance(s))`
- 🎯 Component styles/template/behavior update instantly
- 🎯 **State is preserved** - counter values don't reset
- 🎯 All instances of the component update simultaneously
- 🎯 No full page reload

Without HMR:
- ❌ Page would reload completely
- ❌ All counter states would reset to 0
- ❌ You'd lose any interaction state

## Understanding the Plugin

The plugin intercepts `@customElement('tag-name')` decorators and `customElements.define()` calls, replacing them with a proxy-based registration system that allows hot-swapping the class implementation while keeping the same custom element tag name registered in the browser.

See the main [README.md](../README.md) for technical details.

## Troubleshooting

If HMR isn't working:
1. Check the browser console for errors
2. Verify `vite.config.ts` is correctly loading the plugin
3. Make sure you're editing files in `src/`, not `dist/`
4. Check that the dev server is running with `npm run dev`
