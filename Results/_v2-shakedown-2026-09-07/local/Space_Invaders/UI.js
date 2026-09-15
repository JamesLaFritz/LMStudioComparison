/**
 * UI — glassmorphism HUD + full-screen states for Space Invaders.
 *
 * Pure DOM: no Three.js. The game calls the setters below; UI never reaches
 * into game state. Buttons are wired through onAction(name, cb).
 */

const SCREENS = ['menu', 'pause', 'waveClear', 'gameOver', 'victory'];

export class UI {
  constructor(root) {
    this.root = root;
    this.actions = {};
    this._score = 0;
    this._lives = 0;
    this._wave = 1;
    this._combo = 0;
    this._comboFrac = 0;
    this._powerups = [];
    this._build();
  }

  /* ── construction ─────────────────────────────────────────────── */

  _build() {
    const root = this.root;
    root.innerHTML = `
      <div id="hud" class="hud">
        <div class="chip score-chip">
          <span class="chip-label">SCORE</span>
          <span class="chip-value" id="hud-score">0</span>
        </div>
        <div class="chip wave-chip">
          <span class="chip-label">WAVE</span>
          <span class="chip-value" id="hud-wave">1</span>
        </div>
        <div class="chip lives-chip">
          <span class="chip-label">SHIPS</span>
          <span class="chip-value" id="hud-lives"></span>
        </div>
        <div class="chip combo-chip" id="hud-combo-chip" hidden>
          <span class="chip-label">COMBO</span>
          <span class="chip-value" id="hud-combo">×1</span>
          <div class="combo-bar"><div class="combo-fill" id="hud-combo-fill"></div></div>
        </div>
      </div>
      <div id="powerups" class="powerups"></div>
      <div id="banner" class="banner" hidden></div>
      <div id="screens" class="screens"></div>
      <div class="crt"></div>
    `;

    this.el = {
      score: root.querySelector('#hud-score'),
      wave: root.querySelector('#hud-wave'),
      lives: root.querySelector('#hud-lives'),
      comboChip: root.querySelector('#hud-combo-chip'),
      combo: root.querySelector('#hud-combo'),
      comboFill: root.querySelector('#hud-combo-fill'),
      powerups: root.querySelector('#powerups'),
      banner: root.querySelector('#banner'),
      screens: root.querySelector('#screens'),
    };

    this._buildScreens();
    this._renderLives();
  }

  _buildScreens() {
    const defs = {
      menu: {
        title: 'SPACE INVADERS',
        sub: 'NEON PROTOCOL // RETRO-FUTURISM',
        body: `
          <div class="controls-grid">
            <div><b>MOVE</b><span>WASD / Arrows / Left Stick</span></div>
            <div><b>FIRE</b><span>Space / Z / Button 2</span></div>
            <div><b>PAUSE</b><span>P / Esc / Start</span></div>
          </div>
          <p class="hint">Clear the formation. Survive the descent. Chase the UFO.</p>`,
        buttons: [{ name: 'start', label: 'LAUNCH' }],
      },
      pause: {
        title: 'PAUSED',
        sub: 'SYSTEMS HOLDING',
        body: '<p class="hint">The formation waits for you.</p>',
        buttons: [
          { name: 'resume', label: 'RESUME' },
          { name: 'restart', label: 'RESTART' },
        ],
      },
      waveClear: {
        title: 'WAVE CLEARED',
        sub: 'SECTOR PURGED',
        body: '<p class="hint" id="wave-clear-stats"></p>',
        buttons: [{ name: 'next', label: 'NEXT WAVE' }],
      },
      gameOver: {
        title: 'EARTH FALLEN',
        sub: 'THE FORMATION HAS LANDED',
        body: '<p class="hint" id="gameover-stats"></p>',
        buttons: [{ name: 'restart', label: 'RETRY' }],
      },
      victory: {
        title: 'GALAXY SECURED',
        sub: 'ALL WAVES REPELLED',
        body: '<p class="hint" id="victory-stats"></p>',
        buttons: [{ name: 'restart', label: 'PLAY AGAIN' }],
      },
    };

    for (const name of SCREENS) {
      const d = defs[name];
      const panel = document.createElement('div');
      panel.className = 'screen';
      panel.id = `screen-${name}`;
      panel.hidden = true;
      panel.innerHTML = `
        <div class="glass panel">
          <h1 class="panel-title">${d.title}</h1>
          <div class="panel-sub">${d.sub}</div>
          <div class="panel-body">${d.body}</div>
          <div class="panel-buttons">
            ${d.buttons.map((b) => `<button class="neon-btn" data-action="${b.name}">${b.label}</button>`).join('')}
          </div>
        </div>`;
      this.el.screens.appendChild(panel);
      for (const b of d.buttons) {
        panel.querySelector(`[data-action="${b.name}"]`).addEventListener('click', () => {
          const cb = this.actions[b.name];
          if (cb) cb();
        });
      }
    }
  }

  /* ── public API ───────────────────────────────────────────────── */

  onAction(name, cb) {
    this.actions[name] = cb;
  }

  showScreen(name) {
    for (const s of SCREENS) {
      const el = this.root.querySelector(`#screen-${s}`);
      if (el) el.hidden = s !== name;
    }
  }

  hideScreens() {
    for (const s of SCREENS) {
      const el = this.root.querySelector(`#screen-${s}`);
      if (el) el.hidden = true;
    }
  }

  setStats(id, html) {
    const el = this.root.querySelector(`#${id}`);
    if (el) el.innerHTML = html;
  }

  setScore(v) {
    this._score = v;
    this.el.score.textContent = String(v);
  }

  setLives(v) {
    this._lives = v;
    this._renderLives();
  }

  _renderLives() {
    const n = Math.max(0, Math.min(5, this._lives));
    this.el.lives.textContent = n > 0 ? '▲'.repeat(n) : '—';
  }

  setWave(v) {
    this._wave = v;
    this.el.wave.textContent = String(v);
  }

  /** combo: current multiplier (1..8), frac: 0..1 time left in the combo window */
  setCombo(mult, frac) {
    this._combo = mult;
    this._comboFrac = frac;
    if (mult > 1) {
      this.el.comboChip.hidden = false;
      this.el.combo.textContent = `×${mult}`;
      this.el.comboFill.style.width = `${Math.round(frac * 100)}%`;
    } else {
      this.el.comboChip.hidden = true;
    }
  }

  /** powerups: [{ name, label, color, frac }] — frac 0..1 remaining time (1 = instant) */
  setPowerups(list) {
    const host = this.el.powerups;
    host.innerHTML = '';
    for (const p of list) {
      const chip = document.createElement('div');
      chip.className = 'pu-chip';
      chip.style.setProperty('--pu-color', p.color);
      chip.innerHTML = `
        <span class="pu-label">${p.label}</span>
        <div class="pu-bar"><div class="pu-fill" style="width:${Math.round(p.frac * 100)}%"></div></div>`;
      host.appendChild(chip);
    }
  }

  /** transient center banner, e.g. "WAVE 2", "1-UP!" */
  banner(text, ms = 1600) {
    const el = this.el.banner;
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('banner-in');
    // force reflow so the animation restarts
    void el.offsetWidth;
    el.classList.add('banner-in');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => {
      el.hidden = true;
    }, ms);
  }

  dispose() {
    clearTimeout(this._bannerT);
    this.root.innerHTML = '';
    this.actions = {};
  }
}
