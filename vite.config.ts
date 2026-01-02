import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Increase the limit to 2000kB to accommodate the library-heavy bundle
    chunkSizeWarningLimit: 2000,
  },
  // Set relative base path to fix "blank page" issues on GitHub Pages/sub-folders
  base: './',
});
