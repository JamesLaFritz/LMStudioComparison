import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, open: false },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        hub: 'index.html',
        space_invaders: 'Space_Invaders/index.html'
      }
    }
  }
});
