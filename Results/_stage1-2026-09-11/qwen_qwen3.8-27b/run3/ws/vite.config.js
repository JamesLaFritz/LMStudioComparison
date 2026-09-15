import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// The game imports `three/addons/...` (EffectComposer, UnrealBloomPass,
// OutputPass). Vite resolves the bare `three` package automatically; the
// addons subpath is aliased to the same package's examples/jsm folder so the
// import specifiers in the source stay clean and version-locked.
export default defineConfig({
  resolve: {
    alias: {
      'three/addons': fileURLToPath(new URL('./node_modules/three/examples/jsm', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
