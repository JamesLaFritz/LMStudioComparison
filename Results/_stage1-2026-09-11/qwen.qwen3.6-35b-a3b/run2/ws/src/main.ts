import { Game } from '../games/Space_Invaders/Game.js';

// Bootstrap the Space Invaders game
const game = new Game();
game.start();

// Handle window resize
window.addEventListener('resize', () => game.handleResize());
