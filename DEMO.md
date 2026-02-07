# Testing the vite-plugin-lit-hmr

## Quick Start

### 1. Navigate to the demo directory
```bash
cd demo
```

### 2. Start the development server
```bash
npm run dev
```

### 3. Open your browser
Navigate to the URL shown in the terminal (usually `http://localhost:5173`)

### 4. Test HMR!

You'll see two types of components:
- **my-element**: The default Vite + Lit template counter
- **counter-element**: Two instances of a custom counter component

#### Testing Steps:

1. **Click the counter buttons** to increment the values
   - Set different values on each counter instance
   - Note the current values

2. **Edit the component while it's running:**
   - Open `demo/src/counter-element.ts` in your editor
   - Try these changes:
     - Change `#646cff` to `#ff6464` (changes the blue color to red)
     - Change `"HMR Test Counter"` to `"Hot Reload Works!"`
     - Change the increment method to add 2 instead of 1
   - Save the file after each change

3. **Observe the magic:**
   - ✅ Component updates instantly
   - ✅ Counter values are preserved
   - ✅ No page reload
   - ✅ Console shows: `[lit-hmr] Hot updating <counter-element>`

## What Makes This Special?

Without this plugin:
- Changing a custom element would cause an error: `"Failed to execute 'define' on 'CustomElementRegistry': the name "my-element" has already been used"`
- OR the page would fully reload, losing all state

With this plugin:
- The element updates in-place
- All instances update simultaneously
- State is preserved across updates
- True Hot Module Replacement works!

## Project Structure

```
Vite-Lit/
├── src/
│   └── index.ts              # Plugin source code
├── dist/                     # Built plugin (after npm run build)
│   ├── index.js              # ESM build
│   ├── index.cjs             # CommonJS build
│   └── index.d.ts            # TypeScript definitions
├── demo/                     # Demo application
│   ├── src/
│   │   ├── my-element.ts     # Default Vite+Lit component
│   │   └── counter-element.ts # HMR test component
│   ├── vite.config.ts        # Uses the plugin!
│   └── index.html
├── package.json              # Plugin package
└── README.md                 # Plugin documentation
```

## How the Plugin is Loaded

Check `demo/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import litHmr from '../dist/index.js';

export default defineConfig({
  plugins: [litHmr()],
});
```

The demo imports the plugin directly from the parent `dist/` directory.

## Troubleshooting

**Error: Cannot find module '../dist/index.js'**
- Run `npm run build` in the root directory first

**HMR not working:**
- Check browser console for errors
- Verify the plugin is loaded in `vite.config.ts`
- Make sure you're running `npm run dev`

**Changes not appearing:**
- Make sure you're editing files in `src/`, not `dist/`
- Check that auto-save is enabled in your editor
- Try a hard refresh (Cmd/Ctrl + Shift + R)
