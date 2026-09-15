import { defineConfig } from 'vite';

// Minimal config: three/addons/* resolves through the official `three` export map,
// so no aliasing is required. Games live in their own top-level folders and import
// shared code via relative paths (../shared/...).
export default defineConfig({
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 }
});
