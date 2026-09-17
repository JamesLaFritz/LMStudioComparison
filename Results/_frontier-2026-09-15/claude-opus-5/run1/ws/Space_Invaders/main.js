// Bootstrap: build the shared Engine, start the game, expose a DEV inspection hook, and tear
// everything down on Vite HMR so nothing leaks across reloads.
import '@shared/ui/glass.css';
import { Engine } from '@shared/core/Engine.js';
import { RENDER } from './src/config.js';
import { SpaceInvadersGame } from './src/SpaceInvadersGame.js';

const container = document.getElementById('app');
const params = new URLSearchParams(window.location.search);
const seedParam = params.get('seed');
const seed = seedParam !== null && seedParam !== '' ? Number(seedParam) : undefined;

const engine = new Engine({
  container,
  clearColor: RENDER.clearColor,
  camera: RENDER.camera,
  bloom: RENDER.bloom,
  retro: RENDER.retro,
  samples: RENDER.samples,
  pixelRatioCap: RENDER.pixelRatioCap,
  particleCapacity: RENDER.particleCapacity,
});

const game = new SpaceInvadersGame({ seed: Number.isFinite(seed) ? seed : undefined });
engine.start(game);

if (import.meta.env.DEV) {
  window.__SI__ = {
    engine,
    game,
    snapshot: () => game.snapshot(),
    killAll: () => game.killAll(),
    forceHit: () => game.forceHit(),
    memory: () => ({ ...engine.renderer.info.memory, programs: engine.renderer.info.programs.length }),
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    engine.dispose();
    if (window.__SI__) delete window.__SI__;
  });
}
