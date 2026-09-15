import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@shared\//, replacement: path.resolve(__dirname, 'shared') + '/' },
    ],
  },
});
