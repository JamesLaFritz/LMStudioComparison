import { SpaceInvadersGame } from './SpaceInvadersGame.js';

const canvas = document.getElementById('game-canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

const game = new SpaceInvadersGame(canvas);
game.start();
