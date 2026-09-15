import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      '@shared': new URL('./shared', import.meta.url).pathname,
      '@space-invaders': new URL('./Space_Invaders', import.meta.url).pathname
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
