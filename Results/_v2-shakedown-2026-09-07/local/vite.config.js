import { defineConfig } from 'vite';

// Multi-page build: one entry per game folder. Add a line per new game.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        spaceInvaders: 'Space_Invaders/index.html',
      },
    },
  },
});
