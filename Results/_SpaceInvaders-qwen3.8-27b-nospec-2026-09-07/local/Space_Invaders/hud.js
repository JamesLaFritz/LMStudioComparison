// ============================================================================
// Space_Invaders/hud.js — glassmorphism DOM overlay.
//
// Owns: score / high score / wave / combo cluster, lives pips, pause overlay,
// game-over overlay, and the full-screen hit flash. All DOM, no THREE.
//
// main.js calls:
//   hud.update(sim)          — every frame (cheap: only writes on change)
//   hud.flash()              — on player hit
//   hud.showPause(on)        — pause toggle
//   hud.showGameOver(sim)    — final state
//   hud.reset()              — on restart
// ============================================================================

export class HUD {
  constructor(root) {
    this.root = root;
    this._last = { score: -1, high: -1, wave: -1, combo: -1, lives: -1 };
    this._build();
  }

  _build() {
    const root = this.root;
    root.innerHTML = `
      <div class="hud-top">
        <div class="cluster left">
          <div class="stat"><span class="label">SCORE</span><span class="value" id="hud-score">0</span></div>
          <div class="stat"><span class="label">HI</span><span class="value hi" id="hud-high">0</span></div>
        </div>
        <div class="cluster center">
          <div class="stat wave"><span class="label">WAVE</span><span class="value" id="hud-wave">1</span></div>
          <div class="combo" id="hud-combo" hidden>×1.0</div>
        </div>
        <div class="cluster right">
          <div class="lives" id="hud-lives"></div>
        </div>
      </div>

      <div class="overlay" id="hud-pause" hidden>
        <div class="panel">
          <h2>PAUSED</h2>
          <p><kbd>P</kbd> / <kbd>Esc</kbd> resume · <kbd>R</kbd> restart</p>
        </div>
      </div>

      <div class="overlay" id="hud-over" hidden>
        <div class="panel over">
          <h2>GAME OVER</h2>
          <div class="final">
            <div class="stat"><span class="label">SCORE</span><span class="value" id="hud-final">0</span></div>
            <div class="stat"><span class="label">BEST</span><span class="value hi" id="hud-best">0</span></div>
          </div>
          <p><kbd>R</kbd> / <kbd>A</kbd> restart</p>
        </div>
      </div>

      <div class="flash" id="hud-flash"></div>
    `;

    this.el = {
      score: root.querySelector('#hud-score'),
      high: root.querySelector('#hud-high'),
      wave: root.querySelector('#hud-wave'),
      combo: root.querySelector('#hud-combo'),
      lives: root.querySelector('#hud-lives'),
      pause: root.querySelector('#hud-pause'),
      over: root.querySelector('#hud-over'),
      final: root.querySelector('#hud-final'),
      best: root.querySelector('#hud-best'),
      flash: root.querySelector('#hud-flash'),
    };
  }

  // Cheap per-frame update — only touches the DOM when a value changes.
  update(sim) {
    const l = this._last;
    if (sim.score !== l.score) { this.el.score.textContent = sim.score; l.score = sim.score; }
    if (sim.highScore !== l.high) { this.el.high.textContent = sim.highScore; l.high = sim.highScore; }
    if (sim.wave !== l.wave) { this.el.wave.textContent = sim.wave; l.wave = sim.wave; }

    const combo = 1 + 0.1 * Math.min(sim.combo, 10);
    const comboKey = Math.round(combo * 10);
    if (comboKey !== l.combo) {
      if (comboKey > 10) {
        this.el.combo.hidden = false;
        this.el.combo.textContent = `×${combo.toFixed(1)}`;
      } else {
        this.el.combo.hidden = true;
      }
      l.combo = comboKey;
    }

    if (sim.lives !== l.lives) {
      this.el.lives.innerHTML = '';
      for (let i = 0; i < Math.max(0, sim.lives); i++) {
        const s = document.createElement('span');
        s.className = 'pip';
        this.el.lives.appendChild(s);
      }
      l.lives = sim.lives;
    }
  }

  flash() {
    const f = this.el.flash;
    f.style.transition = 'none';
    f.style.opacity = '0.35';
    requestAnimationFrame(() => {
      f.style.transition = 'opacity 0.4s ease-out';
      f.style.opacity = '0';
    });
  }

  showPause(on) { this.el.pause.hidden = !on; }

  showGameOver(sim) {
    this.el.final.textContent = sim.score;
    this.el.best.textContent = sim.highScore;
    this.el.over.hidden = false;
  }

  reset() {
    this.el.pause.hidden = true;
    this.el.over.hidden = true;
    this._last = { score: -1, high: -1, wave: -1, combo: -1, lives: -1 };
  }

  dispose() { this.root.innerHTML = ''; }
}
