import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  entry: ['Space_Invaders/index.html'],
  plugins: [react()],
  resolve: {
    alias: {
      '../shared': './shared',
    },
  },
});