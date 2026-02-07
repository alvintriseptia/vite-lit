// Example vite.config.js showing how to use this plugin
import { defineConfig } from 'vite';
import litHmr from 'vite-plugin-lit-hmr';

export default defineConfig({
  plugins: [litHmr()],
});
