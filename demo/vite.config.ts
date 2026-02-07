import { defineConfig } from 'vite';
import litHmr from '../dist/index.js';

export default defineConfig({
  plugins: [litHmr()],
  esbuild: {
    target: 'es2022',
  },
});
