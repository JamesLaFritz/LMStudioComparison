import { SpaceInvadersGame } from './SpaceInvadersGame.js';

/**
 * Space Invaders — public facade.
 *
 * `start(container)` builds the whole game (renderer, scene, entities, VFX,
 * UI) and runs it. `stop()` tears everything down in the correct order and
 * releases every GPU resource through the shared ResourceTracker.
 *
 * The facade is the single entry point the root (main.js / registry.js) uses;
 * it owns the lifecycle so the rest of the app never touches internals.
 */
let _game = null;

/**
 * Launch the game into `container`.
 * @param {HTMLElement} container — the #app element
 * @returns {object} { game, stop }
 */
export function start(container) {
  if (_game) stop(); // idempotent: replace any running instance
  const game = new SpaceInvadersGame(container);
  _game = game;
  game.start();
  return { game, stop };
}

/** Stop and fully dispose the running game (if any). */
export function stop() {
  if (_game) {
    _game.stop();
    _game = null;
  }
}

export { SpaceInvadersGame };
