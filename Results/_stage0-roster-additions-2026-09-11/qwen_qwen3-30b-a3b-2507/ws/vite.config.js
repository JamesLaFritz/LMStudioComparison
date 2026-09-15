import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      'three': resolve(__dirname, 'node_modules/three'),
      'three/examples/jsm': resolve(__dirname, 'node_modules/three/examples/jsm')
    }
  }
});