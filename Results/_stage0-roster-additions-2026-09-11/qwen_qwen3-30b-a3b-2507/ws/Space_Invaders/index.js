import { initGame } from '../main.js';
import { Game } from './game.js';

// Entry point for the game
window.addEventListener('load', () => {
  const game = new Game();
  initGame(game);
});

// Export for testing
export { Game };