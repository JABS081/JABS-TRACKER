import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Preserves existing behavior: React plugin (Fast Refresh + JSX) and the
// dist output directory expected by vercel.json. No design/behavior changes.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
