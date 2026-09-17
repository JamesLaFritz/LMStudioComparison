import './ui/styles.css';
import { Game } from './Game.js';

const canvas = document.querySelector('#game-canvas');
const uiRoot = document.querySelector('#ui-root');
let game = null;
let disposed = false;

function showFatalError(error) {
  const panel = document.createElement('section');
  panel.className = 'screen screen--context';
  panel.innerHTML = `
    <div class="screen__panel glass-panel glass-panel--danger">
      <p class="eyebrow">BOOT SEQUENCE FAILED</p>
      <h2>Graphics core unavailable</h2>
      <p>Please refresh in a WebGL-capable browser.</p>
      <pre class="fatal-detail"></pre>
    </div>
  `;
  panel.querySelector('.fatal-detail').textContent = error instanceof Error ? error.message : String(error);
  uiRoot.replaceChildren(panel);
  console.error(error);
}

async function dispose() {
  if (disposed) return;
  disposed = true;
  await game?.dispose();
  game = null;
}

try {
  if (!(canvas instanceof HTMLCanvasElement) || !(uiRoot instanceof HTMLElement)) {
    throw new Error('Required game host elements are missing.');
  }
  game = new Game({ canvas, uiRoot });
} catch (error) {
  showFatalError(error);
}

window.addEventListener('pagehide', () => { void dispose(); }, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(() => { void dispose(); });
}
