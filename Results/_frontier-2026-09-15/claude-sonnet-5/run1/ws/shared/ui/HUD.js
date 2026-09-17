/**
 * Generic glassmorphism HUD scaffold: score/lives/wave corner readouts plus
 * a center overlay for menu/pause/gameover states. Games bind their own
 * event wiring on top of this (see Space_Invaders/ui/HUDOverlay.js).
 */
export class HUD {
  constructor(container) {
    this._root = document.createElement('div');
    this._root.className = 'hud-root';
    container.appendChild(this._root);

    this._scoreValueEl = this._makeCorner('hud-top-left', 'SCORE', '000000');
    this._livesValueEl = this._makeCorner('hud-top-right', 'LIVES', '3');

    this._waveEl = document.createElement('div');
    this._waveEl.className = 'hud-corner hud-bottom-center glass-panel';
    this._waveEl.innerHTML = '<div class="hud-label">WAVE</div><div class="hud-value">1</div>';
    this._root.appendChild(this._waveEl);
    this._waveValueEl = this._waveEl.querySelector('.hud-value');

    this._overlay = document.createElement('div');
    this._overlay.className = 'hud-overlay-center hidden';
    this._root.appendChild(this._overlay);
  }

  _makeCorner(cornerClass, label, initialValue) {
    const el = document.createElement('div');
    el.className = `hud-corner ${cornerClass} glass-panel`;
    el.innerHTML = `<div class="hud-label">${label}</div><div class="hud-value">${initialValue}</div>`;
    this._root.appendChild(el);
    return el.querySelector('.hud-value');
  }

  setScore(value) {
    this._scoreValueEl.textContent = String(Math.max(0, Math.floor(value))).padStart(6, '0');
  }

  setLives(value) {
    this._livesValueEl.textContent = String(Math.max(0, Math.floor(value)));
  }

  setWave(value) {
    this._waveValueEl.textContent = String(Math.max(1, Math.floor(value)));
  }

  showOverlay({ title, subtitle = '', buttonText = '', onButtonClick = null }) {
    this._overlay.innerHTML = '';
    this._overlay.classList.remove('hidden');

    const titleEl = document.createElement('div');
    titleEl.className = 'glass-text';
    titleEl.style.fontSize = '2.6rem';
    titleEl.style.fontWeight = '800';
    titleEl.textContent = title;
    this._overlay.appendChild(titleEl);

    if (subtitle) {
      const subtitleEl = document.createElement('div');
      subtitleEl.className = 'glass-text';
      subtitleEl.style.fontSize = '1rem';
      subtitleEl.style.opacity = '0.8';
      subtitleEl.textContent = subtitle;
      this._overlay.appendChild(subtitleEl);
    }

    if (buttonText) {
      const button = document.createElement('button');
      button.className = 'hud-button glass-panel neon-cyan';
      button.textContent = buttonText;
      if (onButtonClick) button.addEventListener('click', onButtonClick, { once: true });
      this._overlay.appendChild(button);
    }
  }

  hideOverlay() {
    this._overlay.classList.add('hidden');
    this._overlay.innerHTML = '';
  }

  dispose() {
    this._root.remove();
  }
}
