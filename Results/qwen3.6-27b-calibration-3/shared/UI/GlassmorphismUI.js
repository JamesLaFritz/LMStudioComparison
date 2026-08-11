// shared/UI/GlassmorphismUI.js — Glassmorphism overlay system

/**
 * Creates a glassmorphism panel element.
 * @param {string} className - Additional class name
 * @param {string} content - Inner HTML
 * @returns {HTMLElement}
 */
export function createGlassPanel(className = '', content = '') {
  const panel = document.createElement('div');
  panel.className = `glass-panel ${className}`.trim();
  panel.innerHTML = content;
  return panel;
}

/**
 * Injects the glassmorphism CSS into the document head (idempotent).
 */
export function injectGlassCSS() {
  if (document.getElementById('glassmorphism-css')) return;
  const style = document.createElement('style');
  style.id = 'glassmorphism-css';
  style.textContent = `
    /* ── Glassmorphism Base ── */
    .glass-panel {
      background: rgba(10, 10, 30, 0.45);
      backdrop-filter: blur(14px) saturate(180%);
      -webkit-backdrop-filter: blur(14px) saturate(180%);
      border: 1px solid rgba(0, 255, 255, 0.15);
      border-radius: 12px;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
      color: #e0f7ff;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    }

    /* ── Neon Glow Utilities ── */
    .neon-text {
      color: #00ffff;
      text-shadow:
        0 0 7px #00ffff,
        0 0 20px #00ffff,
        0 0 42px rgba(0, 255, 255, 0.4);
    }

    .neon-text-pink {
      color: #ff00ff;
      text-shadow:
        0 0 7px #ff00ff,
        0 0 20px #ff00ff,
        0 0 42px rgba(255, 0, 255, 0.4);
    }

    .neon-border {
      border-color: rgba(0, 255, 255, 0.5) !important;
      box-shadow:
        0 0 15px rgba(0, 255, 255, 0.2),
        0 8px 32px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    /* ── Buttons ── */
    .glass-btn {
      background: rgba(0, 255, 255, 0.1);
      border: 1px solid rgba(0, 255, 255, 0.4);
      border-radius: 8px;
      color: #00ffff;
      padding: 10px 24px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .glass-btn:hover {
      background: rgba(0, 255, 255, 0.25);
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
      transform: translateY(-1px);
    }

    .glass-btn:active {
      transform: translateY(0);
    }

    .glass-btn.danger {
      background: rgba(255, 0, 80, 0.1);
      border-color: rgba(255, 0, 80, 0.4);
      color: #ff0050;
      text-shadow: 0 0 8px rgba(255, 0, 80, 0.6);
    }

    .glass-btn.danger:hover {
      background: rgba(255, 0, 80, 0.25);
      box-shadow: 0 0 20px rgba(255, 0, 80, 0.3);
    }

    /* ── Score Display ── */
    .score-display {
      font-size: 48px;
      font-weight: 800;
      letter-spacing: 4px;
      text-align: center;
      padding: 8px 0;
    }

    /* ── HUD Overlay ── */
    .game-hud {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
    }

    .game-hud > * {
      pointer-events: auto;
    }

    /* ── Floating Score Popup ── */
    .floating-score {
      position: fixed;
      font-size: 28px;
      font-weight: 800;
      pointer-events: none;
      z-index: 200;
      animation: floatUp 1.2s ease-out forwards;
    }

    @keyframes floatUp {
      0% {
        opacity: 1;
        transform: translateY(0) scale(1.2);
      }
      60% {
        opacity: 0.8;
        transform: translateY(-40px) scale(1);
      }
      100% {
        opacity: 0;
        transform: translateY(-80px) scale(0.8);
      }
    }

    /* ── Menu Overlay ── */
    .menu-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(5, 5, 16, 0.85);
      backdrop-filter: blur(8px);
      z-index: 300;
    }

    .menu-content {
      text-align: center;
      padding: 40px 60px;
    }

    .menu-title {
      font-size: 56px;
      font-weight: 900;
      margin-bottom: 24px;
      letter-spacing: 6px;
    }

    .menu-subtitle {
      font-size: 18px;
      opacity: 0.7;
      margin-bottom: 32px;
    }

    /* ── Progress Bar ── */
    .glass-progress {
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }

    .glass-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00ffff, #ff00ff);
      border-radius: 3px;
      transition: width 0.3s ease;
      box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
    }

    /* ── Tooltip ── */
    .glass-tooltip {
      position: absolute;
      background: rgba(10, 10, 30, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 255, 255, 0.3);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      color: #00ffff;
      white-space: nowrap;
      z-index: 500;
      pointer-events: none;
    }

    /* ── Scanline Overlay (optional retro effect) ── */
    .scanlines::after {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0, 0, 0, 0.03) 2px,
        rgba(0, 0, 0, 0.03) 4px
      );
    }
  `;
  document.head.appendChild(style);
}

/**
 * Creates a full game HUD overlay.
 * @param {Object} opts
 * @param {string} opts.title - Game title
 * @param {HTMLElement} opts.container - Parent element
 * @returns {Object} HUD controls reference
 */
export function createGameHUD(opts = {}) {
  injectGlassCSS();

  const hud = document.createElement('div');
  hud.className = 'game-hud';

  // Top bar
  const topBar = createGlassPanel('hud-top-bar', '');
  topBar.style.cssText = `
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 32px;
    display: flex;
    align-items: center;
    gap: 24px;
    z-index: 101;
  `;

  const titleEl = document.createElement('span');
  titleEl.className = 'neon-text';
  titleEl.style.fontSize = '18px';
  titleEl.style.letterSpacing = '3px';
  titleEl.style.fontWeight = '700';
  titleEl.textContent = opts.title || 'GAME';

  const divider = document.createElement('span');
  divider.style.cssText = `
    width: 1px;
    height: 24px;
    background: rgba(0, 255, 255, 0.3);
  `;

  const scoreContainer = document.createElement('div');
  scoreContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 24px;
    font-weight: 800;
  `;

  const p1Score = document.createElement('span');
  p1Score.className = 'neon-text';
  p1Score.textContent = '0';

  const vsText = document.createElement('span');
  vsText.style.cssText = `
    font-size: 14px;
    opacity: 0.5;
    letter-spacing: 2px;
  `;
  vsText.textContent = 'VS';

  const p2Score = document.createElement('span');
  p2Score.className = 'neon-text-pink';
  p2Score.textContent = '0';

  scoreContainer.appendChild(p1Score);
  scoreContainer.appendChild(vsText);
  scoreContainer.appendChild(p2Score);
  topBar.appendChild(titleEl);
  topBar.appendChild(divider);
  topBar.appendChild(scoreContainer);
  hud.appendChild(topBar);

  // Pause button
  const pauseBtn = document.createElement('button');
  pauseBtn.className = 'glass-btn';
  pauseBtn.textContent = '⏸';
  pauseBtn.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 101;
    padding: 8px 14px;
    font-size: 14px;
  `;

  hud.appendChild(pauseBtn);
  opts.container.appendChild(hud);

  return {
    hud,
    topBar,
    p1Score,
    p2Score,
    pauseBtn,
    setP1Score(val) { p1Score.textContent = val; },
    setP2Score(val) { p2Score.textContent = val; },
    setTitle(val) { titleEl.textContent = val; },
    destroy() {
      if (hud.parentNode) hud.parentNode.removeChild(hud);
    }
  };
}

/**
 * Creates a centered menu overlay.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.subtitle
 * @param {Array<{label:string, action:Function}>} opts.buttons
 * @param {HTMLElement} opts.container
 * @returns {HTMLElement}
 */
export function createMenuOverlay(opts = {}) {
  injectGlassCSS();

  const overlay = document.createElement('div');
  overlay.className = 'menu-overlay';

  const content = createGlassPanel('menu-content neon-border', '');

  const title = document.createElement('div');
  title.className = 'menu-title neon-text';
  title.textContent = opts.title || 'GAME';

  const subtitle = document.createElement('div');
  subtitle.className = 'menu-subtitle';
  subtitle.textContent = opts.subtitle || '';

  content.appendChild(title);
  if (opts.subtitle) content.appendChild(subtitle);

  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    margin-top: 24px;
  `;

  (opts.buttons || []).forEach(btn => {
    const button = document.createElement('button');
    button.className = 'glass-btn';
    button.textContent = btn.label;
    button.addEventListener('click', () => {
      btn.action();
    });
    btnContainer.appendChild(button);
  });

  content.appendChild(btnContainer);
  overlay.appendChild(content);
  opts.container.appendChild(overlay);

  return overlay;
}

/**
 * Creates a floating score popup at screen coordinates.
 * @param {string} text
 * @param {number} x - Screen X
 * @param {number} y - Screen Y
 * @param {string} color - CSS color
 * @param {HTMLElement} container
 */
export function spawnFloatingScore(text, x, y, color = '#00ffff', container = document.body) {
  injectGlassCSS();
  const el = document.createElement('div');
  el.className = 'floating-score';
  el.style.cssText = `
    left: ${x}px;
    top: ${y}px;
    color: ${color};
    text-shadow: 0 0 10px ${color}, 0 0 30px ${color};
  `;
  el.textContent = text;
  container.appendChild(el);
  el.addEventListener('animationend', () => {
    if (el.parentNode) el.parentNode.removeChild(el);
  });
}
