/**
 * HUD.js — glassmorphism in-game readouts: score, high score, lives, wave,
 * combo meter, and active power-up timers.
 *
 * Pure DOM. All elements are created here and removed in dispose().
 */

const LIVES_MAX = 6;

export default class HUD {
  /**
   * @param {HTMLElement} root - container to mount into (typically the game root)
   * @param {object} [opts]
   * @param {string} [opts.gameName]
   */
  constructor(root, opts = {}) {
    this.root = root;
    this.gameName = opts.gameName || '';
    this.el = null;
    this._refs = {};
    this._lives = 3;
    this._combo = 1;
    this._effects = [];
    this._build();
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'hud';
    el.innerHTML = `
      <div class="hud-top">
        <div class="hud-block hud-score">
          <span class="hud-label">SCORE</span>
          <span class="hud-value" data-ref="score">0</span>
        </div>
        <div class="hud-block hud-wave">
          <span class="hud-label">WAVE</span>
          <span class="hud-value" data-ref="wave">1</span>
        </div>
        <div class="hud-block hud-high">
          <span class="hud-label">HI</span>
          <span class="hud-value" data-ref="high">0</span>
        </div>
      </div>
      <div class="hud-bottom">
        <div class="hud-block hud-lives">
          <span class="hud-label">SHIPS</span>
          <span class="hud-value" data-ref="lives"></span>
        </div>
        <div class="hud-block hud-combo">
          <span class="hud-label">COMBO</span>
          <span class="hud-value" data-ref="combo">×1</span>
          <div class="combo-bar"><div class="combo-fill" data-ref="comboFill"></div></div>
        </div>
        <div class="hud-block hud-effects" data-ref="effects"></div>
      </div>`;
    this.el = el;
    this.root.appendChild(el);

    for (const key of ['score', 'wave', 'high', 'lives', 'combo', 'comboFill', 'effects']) {
      this._refs[key] = el.querySelector(`[data-ref="${key}"]`);
    }
    this._renderLives();
  }

  setScore(v) { this._refs.score.textContent = String(Math.max(0, Math.floor(v))).padStart(6, '0'); }
  addScore(delta) { /* score is set wholesale by the game; kept for API symmetry */ }
  setHigh(v) { this._refs.high.textContent = String(Math.max(0, Math.floor(v))).padStart(6, '0'); }
  setWave(v) { this._refs.wave.textContent = String(v); }

  setLives(n) { this._lives = Math.max(0, n); this._renderLives(); }

  _renderLives() {
    let html = '';
    for (let i = 0; i < LIVES_MAX; i++) {
      html += i < this._lives
        ? '<span class="life life-on"></span>'
        : '<span class="life life-off"></span>';
    }
    this._refs.lives.innerHTML = html;
  }

  /** combo: 1..8. 1 = no combo (bar empty). */
  setCombo(n) {
    this._combo = Math.max(1, Math.min(8, n));
    this._refs.combo.textContent = `×${this._combo}`;
    this._refs.comboFill.style.width = `${((this._combo - 1) / 7) * 100}%`;
    this._refs.combo.classList.toggle('combo-hot', this._combo >= 4);
  }

  /**
   * Set active power-up effects.
   * @param {Array<{id:string, label:string, remaining:number, total:number}>} effects
   */
  setEffects(effects) {
    this._effects = effects || [];
    const box = this._refs.effects;
    box.innerHTML = '';
    for (const fx of this._effects) {
      const chip = document.createElement('div');
      chip.className = 'fx-chip';
      const pct = Math.max(0, Math.min(1, fx.remaining / fx.total));
      chip.innerHTML = `<span class="fx-label">${fx.label}</span>
        <span class="fx-bar"><span class="fx-fill" style="width:${pct * 100}%"></span></span>`;
      box.appendChild(chip);
    }
  }

  flashComboBreak() {
    this._refs.combo.classList.add('combo-break');
    setTimeout(() => this._refs.combo.classList.remove('combo-break'), 400);
  }

  dispose() {
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
    this._refs = {};
  }
}
