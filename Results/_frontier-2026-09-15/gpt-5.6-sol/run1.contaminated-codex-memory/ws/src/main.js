import './styles/index.css';
import { SpaceInvadersGame } from './Space_Invaders/Game.js';

const canvas = document.querySelector('#game-canvas');
const uiRoot = document.querySelector('#ui-root');
const overlayRoot = document.querySelector('#vfx-overlay');

if (!(canvas instanceof HTMLCanvasElement) || !(uiRoot instanceof HTMLElement) || !(overlayRoot instanceof HTMLElement)) {
  throw new Error('Required Space Invaders mount points are missing');
}

const game = new SpaceInvadersGame({ canvas, uiRoot, overlayRoot, seed: 0x51ace5ed });

const dispose = () => {
  globalThis.removeEventListener('pagehide', dispose);
  void game.dispose();
};

globalThis.addEventListener('pagehide', dispose, { once: true });

try {
  await game.mount();
} catch (error) {
  console.error('Space Invaders failed to mount', error);
  game.showFatalError?.(error);
}

