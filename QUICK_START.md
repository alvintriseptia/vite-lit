# 🚀 Quick Start Guide

## Project Overview

This project contains:
1. **vite-plugin-lit-hmr** - A Vite plugin that enables Hot Module Replacement for Lit custom elements
2. **demo/** - A working demo application to test the plugin

## Getting Started

### Option 1: Test the Demo (Recommended)

```bash
# Navigate to demo directory
cd demo

# Start the dev server
npm run dev

# Open browser to http://localhost:5173
```

Then try editing `demo/src/counter-element.ts` while the app is running!

### Option 2: Use the Plugin in Your Own Project

```bash
# Build the plugin first
npm run build

# In your project, install it
npm install /path/to/vite-plugin-lit-hmr

# Or link it locally for development
npm link
cd /your/project
npm link vite-plugin-lit-hmr
```

Then add to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import litHmr from 'vite-plugin-lit-hmr';

export default defineConfig({
  plugins: [litHmr()],
});
```

## Testing HMR in the Demo

1. Run `cd demo && npm run dev`
2. Open the browser
3. Click counters to set different values
4. Edit `demo/src/counter-element.ts`:
   - Change colors: `#646cff` → `#ff6464`
   - Change text: `"HMR Test Counter"` → `"It Works!"`
   - Save the file
5. Watch it update without page reload! 🎉

## Available Commands

### Root directory (Plugin)
- `npm run build` - Build the plugin
- `npm run dev` - Build in watch mode

### demo/ directory (Demo App)
- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## File Structure

```
Vite-Lit/
├── src/index.ts           # Plugin source
├── dist/                  # Built plugin
├── demo/                  # Demo application
│   ├── src/
│   │   ├── my-element.ts
│   │   └── counter-element.ts
│   └── vite.config.ts
├── README.md              # Plugin documentation
├── DEMO.md                # Demo testing guide
└── QUICK_START.md         # This file
```

## What's Special About This Plugin?

Custom elements can only be registered ONCE per tag name. This makes HMR impossible without tricks.

This plugin solves it by:
- Creating a proxy class that's registered once
- Swapping the proxy's internals when code changes
- Preserving all existing instances and their state

Result: True HMR for Lit components! 🔥

## Next Steps

- Read [README.md](./README.md) for technical details
- Read [DEMO.md](./DEMO.md) for testing instructions
- Read [demo/README.md](./demo/README.md) for demo-specific docs
- Start building with Lit + HMR! 🚀
