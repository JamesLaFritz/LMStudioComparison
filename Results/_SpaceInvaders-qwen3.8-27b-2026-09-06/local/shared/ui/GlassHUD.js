/**
 * GlassHUD — glassmorphism DOM overlay builder.
 *
 * Creates a fixed-position overlay with frosted-glass panels, neon accents,
 * and a compact low-chrome layout (score cluster top-left, status top-right,
 * transient prompts bottom-center). All DOM is owned and removed on dispose().
 */

const BASE_CSS = `
.glass-hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: #e8f4ff;
  user-select: none;
}
.glass-panel {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 18px;
  background: rgba(10, 14, 30, 0.42);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  border: 1px solid rgba(0, 229, 255, 0.28);
  border-radius: 14px;
  box-shadow:
    0 0 18px rgba(0, 229, 255, 0.12),
    inset 0 0 12px rgba(0, 229, 255, 0.05);
}
.glass-panel .label {
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(160, 220, 255, 0.75);
}
.glass-panel .value {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 10px rgba(0, 229, 255, 0.8);
}
.glass-hud .hud-left { top: 16px; left: 16px; flex-direction: column; align-items: flex-start; gap: 4px; }
.glass-hud .hud-right { top: 16px; right: 16px; flex-direction: column; align-items: flex-end; gap: 4px; }
.glass-hud .hud-center { bottom: 18px; left: 50%; transform: translateX(-50%); }
.glass-hud .lives { display: flex; gap: 6px; }
.glass-hud .life-icon {
  width: 14px; height: 14px;
  background: #00e5ff;
  clip-path: polygon(50% 0%, 100% 100%, 50% 78%, 0% 100%);
  box-shadow: 0 0 8px #00e5ff;
}
.glass-hud .combo {
  font-size: 14px; font-weight: 700;
  color: #ff2d95;
  text-shadow: 0 0 10px rgba(255, 45, 149, 0.9);
  opacity: 0;
  transition: opacity 0.2s;
}
.glass-hud .combo.active { opacity: 1; }
.glass-hud .prompt {
  font-size: 12px;
  letter-spacing: 1px;
  color: rgba(200, 240, 255, 0.85);
  text-shadow: 0 0 8px rgba(0, 229, 255, 0.5);
}
.glass-hud .overlay-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: rgba(4, 6, 16, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: auto;
}
.glass-hud .overlay-screen h1 {
  margin: 0;
  font-size: 42px;
  font-weight: 800;
  letter-spacing: 6px;
  text-transform: uppercase;
  background: linear-gradient(90deg, #00e5ff, #ff2d95);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 18px rgba(0, 229, 255, 0.6));
}
.glass-hud .overlay-screen p {
  margin: 0;
  font-size: 14px;
  color: rgba(200, 235, 255, 0.8);
  letter-spacing: 1px;
}
.glass-hud .overlay-screen .btn {
  pointer-events: auto;
  cursor: pointer;
  padding: 12px 34px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #041018;
  background: linear-gradient(90deg, #00e5ff, #7df9ff);
  border: none;
  border-radius: 10px;
  box-shadow: 0 0 22px rgba(0, 229, 255, 0.55);
  transition: transform 0.12s, box-shadow 0.12s;
}
.glass-hud .overlay-screen .btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 34px rgba(0, 229, 255, 0.85);
}
.glass-hud .hidden { display: none !important; }
`;

export class GlassHUD {
  /**
   * @param {HTMLElement} container - element to attach the HUD into (usually document.body)
   * @param {object} [opts]
   * @param {string} [opts.title] - overlay title text
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.title = opts.title || 'SPACE INVADERS';

    this.root = document.createElement('div');
    this.root.className = 'glass-hud';

    const style = document.createElement('style');
    style.textContent = BASE_CSS;
    this.root.appendChild(style);

    // Left cluster: score + high score
    this.left = document.createElement('div');
    this.left.className = 'glass-panel hud-left';
    this.left.innerHTML = `
      <div><span class="label">Score</span> <span class="value" id="hud-score">0</span></div>
      <div><span class="label">Best</span> <span class="value" id="hud-best" style="font-size:15px;opacity:.85">0</span></div>
    `;
    this.root.appendChild(this.left);

    // Right cluster: wave + lives + combo
    this.right = document.createElement('div');
    this.right.className = 'glass-panel hud-right';
    this.right.innerHTML = `
      <div><span class="label">Wave</span> <span class="value" id="hud-wave">1</span></div>
      <div class="lives" id="hud-lives"></div>
      <div class="combo" id="hud-combo">×1.0</div>
    `;
    this.root.appendChild(this.right);

    // Center: transient prompt
    this.center = document.createElement('div');
    this.center.className = 'glass-panel hud-center';
    this.center.innerHTML = `<span class="prompt" id="hud-prompt"></span>`;
    this.root.appendChild(this.center);

    // Full-screen overlay (start / game over / pause)
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay-screen hidden';
    this.overlay.innerHTML = `
      <h1 id="hud-overlay-title">${this.title}</h1>
      <p id="hud-overlay-sub">WASD / Arrows to move · Space / Z to fire · Gamepad supported</p>
      <button class="btn" id="hud-overlay-btn">Start</button>
    `;
    this.root.appendChild(this.overlay);

    this.el = {
      score: this.left.querySelector('#hud-score'),
      best: this.left.querySelector('#hud-best'),
      wave: this.right.querySelector('#hud-wave'),
      lives: this.right.querySelector('#hud-lives'),
      combo: this.right.querySelector('#hud-combo'),
      prompt: this.center.querySelector('#hud-prompt'),
      overlay: this.overlay,
      overlayTitle: this.overlay.querySelector('#hud-overlay-title'),
      overlaySub: this.overlay.querySelector('#hud-overlay-sub'),
      overlayBtn: this.overlay.querySelector('#hud-overlay-btn')
    };

    container.appendChild(this.root);
    this._promptTimer = 0;
  }

  setScore(v) { this.el.score.textContent = String(v); }
  setBest(v) { this.el.best.textContent = String(v); }
  setWave(v) { this.el.wave.textContent = String(v); }

  setLives(n) {
    this.el.lives.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'life-icon';
      this.el.lives.appendChild(s);
    }
  }

  setCombo(mult) {
    if (mult > 1.0) {
      this.el.combo.textContent = '×' + mult.toFixed(1);
      this.el.combo.classList.add('active');
    } else {
      this.el.combo.classList.remove('active');
    }
  }

  /** Show a transient prompt for `ms` milliseconds. */
  prompt(text, ms = 2200) {
    this.el.prompt.textContent = text;
    clearTimeout(this._promptTimer);
    if (ms > 0) {
      this._promptTimer = setTimeout(() => { this.el.prompt.textContent = ''; }, ms);
    }
  }

  showOverlay(title, sub, btnLabel, onBtn) {
    this.el.overlayTitle.textContent = title;
    this.el.overlaySub.textContent = sub;
    this.el.overlayBtn.textContent = btnLabel;
    this.el.overlay.classList.remove('hidden');
    this.el.overlayBtn.onclick = onBtn;
  }

  hideOverlay() { this.el.overlay.classList.add('hidden'); }

  dispose() {
    clearTimeout(this._promptTimer);
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
