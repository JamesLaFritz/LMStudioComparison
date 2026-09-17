import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@space': fileURLToPath(new URL('./src/Space_Invaders', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
  },
});
