import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared')
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        spaceInvaders: resolve(__dirname, 'Space_Invaders/index.html')
      }
    }
  },
  server: {
    port: 5173
  }
});
