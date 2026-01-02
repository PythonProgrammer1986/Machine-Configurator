import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // 1. Raise the threshold to hide the warning (2MB)
    chunkSizeWarningLimit: 2000,
    
    // 2. Disable minification ONLY if esbuild keeps crashing (Step 4 from before)
    // minify: false, 

    rollupOptions: {
      output: {
        // 3. Modern replacement for splitVendorChunkPlugin
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Groups all third-party libraries into a single 'vendor' chunk
            return 'vendor';
          }
        },
      },
    },
  },
});
