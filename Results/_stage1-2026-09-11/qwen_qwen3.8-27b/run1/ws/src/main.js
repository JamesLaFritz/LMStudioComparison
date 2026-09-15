/**
 * main.js — root entry point.
 *
 * index.html loads this module; it finds the #app container and hands it to
 * the Space Invaders facade, which owns the renderer, loop, input, game,
 * UI, and the full dispose cascade.
 */
import { start, stop } from './Space_Invaders/index.js';

const container = document.getElementById('app');
if (!container) {
  throw new Error('main.js: #app container not found');
}

const handle = start(container);

// Expose for the host page / dev tools (e.g. a "stop" button or hot reload).
window.__NEON_INVADERS__ = { start, stop, game: handle.game };
