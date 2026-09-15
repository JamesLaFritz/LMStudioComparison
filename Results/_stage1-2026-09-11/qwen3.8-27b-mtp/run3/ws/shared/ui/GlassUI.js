// shared/ui/GlassUI.js
// Glassmorphism HUD + overlay system. Pure DOM, zero three imports.
// All dynamic updates touch textContent / style.width only (compositor-friendly).

import './glass.css';

const EFFECT_LABELS = { RAPID: 'RAPID FIRE', SPREAD: 'SPREAD SHOT', SLOW: 'FLEET SLOW' };

export class GlassUI {
  /**
   * @param {HTMLElement} container — the #app div (HUD + overlays mount here)
   * @param {{onStart?:Function,onRestart?:Function, onResume?:Function, onMenu?:Function, onContinue?:Function}} handlers
   */
  constructor(container, handlers = {}) {
    this.container = container;
    this.handlers = handlers;

    // ---- HUD -------------------------------------------------------------
    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML = `
      <div class="hud-top">
        <div class="hud-left glass-panel">
          <div class="stat"><span class="stat-label">SCORE</span><span id="ui-score" class="stat-value neon-cyan">0</span></div>
          <div class="stat"><span class="stat-label">BEST</span><span id="ui-best" class="stat-value dim">0</span></div>
          <div class="combo-wrap"><div id="ui-combo-bar" class="combo-bar"></div>
            <span id="ui-combo-x" class="combo-x hidden">×1.25</span></div>
        </div>
        <div class="hud-center glass-panel level-chip"><span class="stat-label">SECTOR</span><span id="ui-level" class="stat-value neon-magenta">01</span></div>
        <div class="hud-right glass-panel lives-wrap"><span class="stat-label">SHIPS</span><span id="ui-lives"></span></div>
      </div>
      <div id="ui-chips" class="chips"></div>
      <div id="ui-incoming" class="incoming hidden"><span class="blink">⚠ INCOMING — MYSTERY SHIP</span></div>
      <div id="ui-debug" class="debug"></div>`;
    container.appendChild(hud);

    this.el = {
      score: hud.querySelector('#ui-score'),
      best: hud.querySelector('#ui-best'),
      level: hud.querySelector('#ui-level'),
      lives: hud.querySelector('#ui-lives'),
      comboBar: hud.querySelector('#ui-combo-bar'),
      comboX: hud.querySelector('#ui-combo-x'),
      chips: hud.querySelector('#ui-chips'),
      incoming: hud.querySelector('#ui-incoming'),
      debug: hud.querySelector('#ui-debug'),
    };

    // ---- Overlays ---------------------------------------------------------
    const ov = document.createElement('div');
    ov.className = 'overlays';
    ov.innerHTML = `
      <section id="ov-menu" class="overlay">
        <div class="glass-panel overlay-card">
          <h1 class="title neon-cyan">NEON INVASION</h1>
          <p class="subtitle">A RETRO-FUTURIST SPACE INVADERS</p>
          <ul class="controls-list">
            <li><b>MOVE</b> — A / D · ← → · gamepad stick</li>
            <li><b>FIRE</b> — SPACE · X / B button</li>
            <li><b>PAUSE</b> — P or ESC · start button</li>
          </ul>
          <button id="btn-start" class="neon-btn">LAUNCH DEFENSE GRID</button>
        </div>
      </section>

      <section id="ov-pause" class="overlay hidden">
        <div class="glass-panel overlay-card">
          <h2 class="title neon-cyan">PAUSED</h2>
          <button id="btn-resume" class="neon-btn">RESUME</button>
          <button id="btn-pause-menu" class="ghost-btn">ABANDON RUN</button>
        </div>
      </section>

      <section id="ov-sector" class="overlay hidden">
        <div class="glass-panel overlay-card center">
          <h2 class="title neon-magenta">SECTOR CLEARED</h2>
          <p class="subtitle" id="sector-sub">THE FLEET RETURNS… FASTER</p>
        </div>
      </section>

      <section id="ov-gameover" class="overlay hidden">
        <div class="glass-panel overlay-card center">
          <h2 class="title danger">GRID BREACHED</h2>
          <p class="subtitle">THE FLEET HAS LANDED</p>
          <div class="final-stats"><span id="go-score" class="stat-value neon-cyan big">0</span><span class="stat-label">FINAL SCORE</span></div>
          <button id="btn-restart" class="neon-btn">RE-DEPLOY</button>
          <button id="btn-go-menu" class="ghost-btn">MAIN MENU</button>
        </div>
      </section>

      <section id="ov-victory" class="overlay hidden">
        <div class="glass-panel overlay-card center">
          <h2 class="title neon-cyan">GALAXY SECURED</h2>
          <p class="subtitle">SIX SECTORS PURGED — THE NEON SKIES ARE YOURS</p>
          <div class="final-stats"><span id="vic-score" class="stat-value neon-magenta big">0</span><span class="stat-label">FINAL SCORE</span></div>
          <button id="btn-continue" class="neon-btn">CONTINUE — ENDLESS MODE</button>
          <button id="btn-vic-menu" class="ghost-btn">MAIN MENU</button>
        </div>
      </section>`;
    container.appendChild(ov);

    this.ov = {
      menu: ov.querySelector('#ov-menu'),
      pause: ov.querySelector('#ov-pause'),
      sector: ov.querySelector('#ov-sector'),
      gameover: ov.querySelector('#ov-gameover'),
      victory: ov.querySelector('#ov-victory'),
    };

    // ---- Button wiring ----------------------------------------------------
    const wire = (id, fn) => {
      const b = ov.querySelector(id);
      if (b && typeof this.handlers[fn] === 'function') b.addEventListener('click', () => this.handlers[fn]());
    };
    wire('#btn-start', 'onStart');
    wire('#btn-resume', 'onResume');
    wire('#btn-pause-menu', 'onMenu');
    wire('#btn-restart', 'onRestart');
    wire('#btn-go-menu', 'onMenu');
    wire('#btn-continue', 'onContinue');
    wire('#btn-vic-menu', 'onMenu');

    this._livesShown = -1;
  }

  // ---- HUD updates --------------------------------------------------------
  setScore(n) { if (this.el.score.textContent !== String(n)) this.el.score.textContent = String(n); }
  setBest(n) { this.el.best.textContent = String(n); }
  setLevel(n) { this.el.level.textContent = String(Math.max(1, n)).padStart(2, '0'); }

  setLives(n) {
    if (n === this._livesShown) return;
    this._livesShown = n;
    let html = '';
    for (let i = 0; i < Math.max(0, n); i++) html += '<span class="life-icon">▲</span>';
    this.el.lives.innerHTML = html || '<span class="dim">—</span>';
  }

  /** chain: current combo count (1..n), frac: remaining fraction of the window [0..1] */
  setCombo(chain, frac) {
    if (chain < 2) {
      this.el.comboX.classList.add('hidden');
      this.el.comboBar.style.width = '0%';
      return;
    }
    const mult = Math.min(4, 1 + 0.25 * (chain - 1));
    this.el.comboX.textContent = `×${mult.toFixed(2)}`;
    this.el.comboX.classList.remove('hidden');
    this.el.comboBar.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }

  /** Add/update a timed effect chip. `remaining` in seconds (null → static). */
  addEffectChip(type, remaining) {
    let chip = this.el.chips.querySelector(`[data-type="${type}"]`);
    if (!chip) {
      chip = document.createElement('div');
      chip.className = 'effect-chip';
      chip.dataset.type = type;
      chip.innerHTML = `<span>${EFFECT_LABELS[type] || type}</span><i class="chip-bar"><b></b></i>`;
      this.el.chips.appendChild(chip);
    }
    const bar = chip.querySelector('b');
    if (remaining == null) {
      bar.style.width = '100%';
    } else {
      const total = type === 'SLOW' ? 5 : 8;
      bar.style.width = `${Math.max(0, Math.min(1, remaining / total)) * 100}%`;
    }
  }

  removeEffectChip(type) {
    const chip = this.el.chips.querySelector(`[data-type="${type}"]`);
    if (chip) chip.remove();
  }

  clearChips() { this.el.chips.innerHTML = ''; }

  showIncoming(on) { this.el.incoming.classList.toggle('hidden', !on); }

  /** Debug line: particle count / draw calls. */
  setDebug(text) { this.el.debug.textContent = text; }

  // ---- Overlay control ----------------------------------------------------
  showOverlay(name) {
    for (const k of Object.keys(this.ov)) this.ov[k].classList.toggle('hidden', k !== name);
  }

  hideOverlays() {
    for (const k of Object.keys(this.ov)) this.ov[k].classList.add('hidden');
  }

  setFinalScore(n) {
    const a = document.getElementById('go-score'); if (a) a.textContent = String(n);
    const b = document.getElementById('vic-score'); if (b) b.textContent = String(n);
  }

  dispose() {
    this.container.querySelectorAll('.hud, .overlays').forEach((n) => n.remove());
  }
}
