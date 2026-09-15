// Space_Invaders/index.js — game entry point (GameContract).
//
// Default export: { name, create(rootEl) -> { start, pause, resume, destroy } }
//
// `create` builds the full game (renderer, scene, entities, systems, VFX,
// audio, UI) inside `rootEl` and returns the lifecycle handle. `destroy`
// tears everything down and frees every GPU resource via the MemoryRegistry.

import SpaceInvadersGame from './SpaceInvadersGame.js';

export default {
  name: 'Space Invaders',
  create(rootEl) {
    const game = new SpaceInvadersGame(rootEl);
    return {
      start: () => game.start(),
      pause: () => game.pause(),
      resume: () => game.resume(),
      destroy: () => game.destroy(),
    };
  },
};
