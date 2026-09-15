import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'static',
  
  server: {
    port: 3000,
    open: false
  },
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
      '@space-invaders': resolve(__dirname, 'space-invaders')
    },
    // Fix for three.js addons resolution in Vite
    conditions: ['module', 'browser']
  },
  
  optimizeDeps: {
    exclude: ['three/addons/*'],
    esbuildOptions: {
      resolveExtensions: ['.js', '.mjs', '.json']
    }
  }
});
