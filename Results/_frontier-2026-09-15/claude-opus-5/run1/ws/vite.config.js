import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));

// Multi-page build: the collection hub plus one entry per game folder.
// Games are added here as they are built; each one is fully self-contained
// and only reaches outside its folder through the `@shared` alias.
export default defineConfig({
  root,
  resolve: {
    alias: {
      '@shared': resolve(root, 'shared'),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        hub: resolve(root, 'index.html'),
        space_invaders: resolve(root, 'Space_Invaders/index.html'),
      },
    },
  },
  server: {
    open: false,
    host: '127.0.0.1',
  },
});
