// Space_Invaders — game entry point.
// Wires the shared Engine + InputController to the Game orchestrator and starts
// the loop. main.js (workspace root) imports this module.

import { Engine } from '../shared/core/Engine.js';
import { InputController } from '../shared/core/InputController.js';
import { Game } from './Game.js';
import { CAMERA, FOG, BG_COLOR } from './config.js';

export function createSpaceInvaders(container) {
  const engine = new Engine(container, {
    fov: CAMERA.FOV,
    cameraPos: CAMERA.POS,
    lookAt: CAMERA.LOOK_AT,
    fog: FOG,
    bgColor: BG_COLOR,
  });

  const input = new InputController();
  const game = new Game(engine, input);

  engine.start();

  // Teardown contract for host pages / tests.
  return {
    engine, input, game,
    dispose() {
      engine.teardown(); // runs all registered disposers in reverse construction order
    },
  };
}
