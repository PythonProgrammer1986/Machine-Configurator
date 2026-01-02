import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Raises the warning threshold to 2MB (2000 KiB)
    chunkSizeWarningLimit: 2000,
  },
});