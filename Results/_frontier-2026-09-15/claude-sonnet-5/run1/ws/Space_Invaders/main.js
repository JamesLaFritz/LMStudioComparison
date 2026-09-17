import { SpaceInvadersGame } from './SpaceInvadersGame.js';

const root = document.getElementById('game-root');
const canvas = document.getElementById('game-canvas');

const game = new SpaceInvadersGame(root, canvas);
game.start();

window.__spaceInvadersGame = game;
