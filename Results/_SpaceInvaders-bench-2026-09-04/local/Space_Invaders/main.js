import { Game } from './src/Game.js';
import { InputController } from './src/utils/InputController.js';

// Create a canvas container in the body
const container = document.createElement('div');
container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;pointer-events:none;';
document.body.appendChild(container);

// Input controller
const inputController = new InputController();

// Minimal audio synth stub (no real audio yet)
const audioSynth = {
  playPlayerShoot() {},
  playEnemyDeath() {},
  playPlayerDeath() {},
  playUfoDeath() {},
  playShieldHit() {},
  playWaveTransition() {},
  stopAmbientDrone() {},
};

// Create game instance — it will start the render loop in init()
const game = new Game(container, inputController, audioSynth);
game.start();

window.addEventListener('beforeunload', () => {
  game.dispose();
});
