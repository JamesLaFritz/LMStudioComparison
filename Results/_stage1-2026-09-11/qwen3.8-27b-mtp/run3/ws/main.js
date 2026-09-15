// NEON INVASION — entry point.
// index.html mounts <div id="app">; this file boots the game into it and keeps
// a single teardown handle for explicit disposal (hot-reload / page unload).

import { boot } from './Space_Invaders/index.js';

const container = document.getElementById('app');
if (!container) throw new Error('#app mount point missing — check index.html');

let teardown = null;
try {
  teardown = boot(container);
} catch (err) {
  // Boot failure: surface it in the DOM so a blank page is never silent.
  console.error('[NEON INVASION] boot failed:', err);
  container.innerHTML =
    '<pre style="color:#ff5ce1;font-family:monospace;padding:24px;white-space:pre-wrap">' +
    'BOOT FAILURE\n' + (err && err.stack ? err.stack : String(err)) + '</pre>';
}

// Explicit teardown path — wired to page unload so GPU resources are released.
window.addEventListener('pagehide', () => {
  if (teardown) {
    try { teardown(); } catch (e) { /* already torn down */ }
    teardown = null;
  }
}, { once: true });
