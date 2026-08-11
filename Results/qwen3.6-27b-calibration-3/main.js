// main.js — Root entry point for the AAA Retro-Futurism Arcade
import { GameRenderer } from './shared/Rendering/Renderer.js';

// Game registry — add new games here
const GAMES = {
  pong: { name: 'Pong', import: () => import('./Pong/PongGame.js').then(m => m.PongGame) },
  // snake: { name: 'Snake', import: () => import('./Snake/SnakeGame.js').then(m => m.SnakeGame) },
  // breakout: { name: 'Breakout', import: () => import('./Breakout/BreakoutGame.js').then(m => m.BreakoutGame) },
};

let currentGame = null;
let gameRenderer = null;
let animFrameId = null;
let lastTime = 0;

// Build game selector UI
function buildGameSelector() {
  const container = document.getElementById('game-container');
  container.innerHTML = '';

  const selector = document.createElement('div');
  selector.className = 'game-selector';
  selector.innerHTML = `
    <h1 class="selector-title">RETRO-FUTURISM ARCADE</h1>
    <p class="selector-subtitle">Select a game to begin</p>
    <div class="game-grid" id="game-grid"></div>
  `;
  container.appendChild(selector);

  const grid = document.getElementById('game-grid');
  for (const [key, game] of Object.entries(GAMES)) {
    const btn = document.createElement('button');
    btn.className = 'game-card';
    btn.innerHTML = `<span class="game-card-title">${game.name}</span>`;
    btn.addEventListener('click', () => loadGame(key));
    grid.appendChild(btn);
  }
}

async function loadGame(key) {
  const gameInfo = GAMES[key];
  if (!gameInfo) return;

  try {
    const GameClass = await gameInfo.import();
    await startGame(GameClass);
  } catch (err) {
    console.error(`Failed to load ${gameInfo.name}:`, err);
  }
}

async function startGame(GameClass) {
  // Cancel any running loop
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  // Clean up previous game
  if (currentGame) {
    await currentGame.destroy();
    currentGame = null;
  }

  // Clean up previous renderer
  if (gameRenderer) {
    gameRenderer.dispose();
    gameRenderer = null;
  }

  // Clear container
  const container = document.getElementById('game-container');
  container.innerHTML = '';

  // Create new renderer
  gameRenderer = new GameRenderer(container);

  // Create and start game
  currentGame = new GameClass(gameRenderer);
  await currentGame.init();

  // Start render loop
  lastTime = performance.now();
  function loop(now) {
    animFrameId = requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    currentGame.update(dt);
    gameRenderer.render();
  }
  animFrameId = requestAnimationFrame(loop);
}

// Back button handler
window.__arcadeBack = function () {
  if (currentGame) {
    currentGame.destroy().then(() => {
      currentGame = null;
      if (gameRenderer) {
        gameRenderer.dispose();
        gameRenderer = null;
      }
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      buildGameSelector();
    });
  }
};

// Initialize
buildGameSelector();
