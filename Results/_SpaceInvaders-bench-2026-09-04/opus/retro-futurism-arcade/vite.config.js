import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * Import-path discipline for the arcade.
 *
 * Every module addresses the engine layer as `@shared/...` and any sibling
 * title as `@game/<Title>/...`. This eliminates deep `../../../` chains, which
 * is a hard requirement of the project directive: no file in a game folder may
 * traverse more than one level up.
 *
 * `three` is aliased explicitly so that a single instance of the library is
 * guaranteed even if a transitive dependency were ever added. Two copies of
 * three.js in one bundle silently breaks `instanceof` checks and material
 * caching, which is extremely hard to diagnose after the fact.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@game': fileURLToPath(new URL('./src/games', import.meta.url)),
      '@hub': fileURLToPath(new URL('./src/hub', import.meta.url)),
      three: fileURLToPath(new URL('./node_modules/three', import.meta.url))
    }
  },
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('/src/shared/')) return 'engine';
          return undefined;
        }
      }
    }
  }
});
