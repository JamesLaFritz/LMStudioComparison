/**
 * GlassUI — glassmorphism design system for the whole collection.
 * Builds a HUD + menu/pause/game-over screens inside a host element,
 * exposes event callbacks and per-frame HUD updates. No external assets:
 * all styling is injected CSS with neon glow accents.
 */

const BASE_CSS = `
.si-ui { position:absolute; inset:0; pointer-events:none; font-family:'Segoe UI', system-ui, sans-serif; color:#d8f6ff; overflow:hidden; }
.si-glass { background:rgba(8,16,34,.52); backdrop-filter:blur(14px) saturate(1.5); -webkit-backdrop-filter:blur(14px) saturate(1.5); border:1px solid rgba(0,245,255,.28); box-shadow:0 0 26px rgba(0,245,255,.16), inset 0 0 22px rgba(0,245,255,.05); border-radius:16px; }
.si-hud { position:absolute; top:14px; left:14px; right:14px; display:flex; align-items:center; justify-content:space-between; padding:10px 18px; gap:12px; }
.si-hud .stat { display:flex; flex-direction:column; min-width:96px; }
.si-hud .stat.center { align-items:center; text-align:center; }
.si-hud .stat.right { align-items:flex-end; text-align:right; }
.si-label { font-size:10px; letter-spacing:.28em; color:#7fd4e8; opacity:.9; }
.si-value { font-size:22px; font-weight:700; letter-spacing:.06em; color:#eaffff; text-shadow:0 0 12px rgba(0,245,255,.8); font-variant-numeric:tabular-nums; }
.si-value.magenta { color:#ffd9f6; text-shadow:0 0 12px rgba(255,43,214,.8); }
.si-combo { display:inline-block; margin-top:2px; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:700; letter-spacing:.14em; color:#0a0f1e; background:linear-gradient(90deg,#ffd166,#ff2bd6); box-shadow:0 0 14px rgba(255,179,0,.75); }
.si-combo.hidden { display:none; }
.si-screen { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; pointer-events:auto; background:radial-gradient(ellipse at center, rgba(4,10,24,.35), rgba(2,6,16,.72)); }
.si-screen.hidden { display:none; }
.si-title { font-size:52px; font-weight:800; letter-spacing:.3em; text-transform:uppercase; color:#eaffff; text-shadow:0 0 18px rgba(0,245,255,.9), 0 0 60px rgba(0,245,255,.4); margin-right:-.3em; }
.si-title .accent { color:#ff2bd6; text-shadow:0 0 18px rgba(255,43,214,.9), 0 0 60px rgba(255,43,214,.4); }
.si-sub { font-size:13px; letter-spacing:.34em; text-transform:uppercase; color:#8fd8ea; }
.si-panel { padding:26px 40px; display:flex; flex-direction:column; align-items:center; gap:16px; max-width:520px; }
.si-btn { pointer-events:auto; cursor:pointer; font-family:inherit; font-size:15px; font-weight:700; letter-spacing:.3em; text-transform:uppercase; color:#eaffff; background:rgba(0,245,255,.1); border:1px solid rgba(0,245,255,.55); padding:13px 34px; border-radius:12px; transition:all .16s ease; text-shadow:0 0 8px rgba(0,245,255,.9); box-shadow:0 0 16px rgba(0,245,255,.22), inset 0 0 12px rgba(0,245,255,.08); }
.si-btn:hover { background:rgba(0,245,255,.24); box-shadow:0 0 30px rgba(0,245,255,.5), inset 0 0 16px rgba(0,245,255,.16); transform:translateY(-1px); }
.si-btn.magenta { color:#ffe9fb; border-color:rgba(255,43,214,.6); background:rgba(255,43,214,.1); text-shadow:0 0 8px rgba(255,43,214,.9); box-shadow:0 0 16px rgba(255,43,214,.25), inset 0 0 12px rgba(255,43,214,.08); }
.si-btn.magenta:hover { background:rgba(255,43,214,.26); box-shadow:0 0 30px rgba(255,43,214,.5), inset 0 0 16px rgba(255,43,214,.18); }
.si-hint { font-size:11px; letter-spacing:.2em; color:#79b9cc; line-height:2; text-align:center; }
.si-kbd { display:inline-block; padding:1px 8px; margin:0 3px; border:1px solid rgba(0,245,255,.4); border-radius:6px; background:rgba(0,245,255,.08); color:#c9f4ff; font-size:10px; }
.si-score-big { font-size:34px; font-weight:800; letter-spacing:.1em; color:#eaffff; text-shadow:0 0 16px rgba(0,245,255,.9); font-variant-numeric:tabular-nums; }
.si-record { font-size:13px; font-weight:700; letter-spacing:.3em; color:#ffd166; text-shadow:0 0 12px rgba(255,209,102,.8); animation:sipulse 1.1s ease-in-out infinite; }
.si-record.hidden { display:none; }
@keyframes sipulse { 0%,100% { opacity:.65; transform:scale(1);} 50% { opacity:1; transform:scale(1.06);} }
`;

export class GlassUI {
  /** @param {HTMLElement} root host element (positioned, full-bleed) */
  constructor(root) {
    this.root = root;
    this._listeners = {};
    this._built = false;
  }

  build() {
    if (this._built) return this;
    const style = document.createElement('style');
    style.textContent = BASE_CSS;
    this.root.appendChild(style);

    const ui = document.createElement('div');
    ui.className = 'si-ui';
    this.root.appendChild(ui);
    this.el = { root: ui };

    // ── HUD ────────────────────────────────────────────────
    const hud = document.createElement('div');
    hud.className = 'si-glass si-hud';
    hud.innerHTML = `
      <div class="stat"><span class="si-label">SCORE</span><span class="si-value" data-k="score">0</span></div>
      <div class="stat center">
        <span class="si-label">WAVE</span>
        <span class="si-value magenta" data-k="wave">1</span>
        <span class="si-combo hidden" data-k="combo">×2 COMBO</span>
      </div>
      <div class="stat right"><span class="si-label">BEST · LIVES</span><span class="si-value" data-k="bestlives">0 · ▲▲▲</span></div>`;
    ui.appendChild(hud);
    this.el.hud = hud;

    // ── Menu screen ────────────────────────────────────────
    const menu = document.createElement('div');
    menu.className = 'si-screen';
    menu.innerHTML = `
      <div class="si-glass si-panel">
        <div class="si-sub">SECTOR 7 · DEFENSE GRID ONLINE</div>
        <h1 class="si-title">SPACE<span class="accent">INVADERS</span></h1>
        <div class="si-hint">
          <span class="si-kbd">A</span><span class="si-kbd">D</span> / <span class="si-kbd">◀</span><span class="si-kbd">▶</span> move&nbsp;&nbsp;·&nbsp;&nbsp;<span class="si-kbd">SPACE</span> fire<br>
          <span class="si-kbd">P</span> pause&nbsp;&nbsp;·&nbsp;&nbsp;gamepad supported (stick / dpad + A)
        </div>
        <button class="si-btn" data-action="start">Start Mission</button>
      </div>`;
    ui.appendChild(menu);
    this.el.menu = menu;

    // ── Pause screen ───────────────────────────────────────
    const pause = document.createElement('div');
    pause.className = 'si-screen hidden';
    pause.innerHTML = `
      <div class="si-glass si-panel">
        <h1 class="si-title" style="font-size:34px;">PAUSED</h1>
        <button class="si-btn" data-action="resume">Resume</button>
        <button class="si-btn magenta" data-action="menu">Abort to Menu</button>
      </div>`;
    ui.appendChild(pause);
    this.el.pause = pause;

    // ── Game over screen ───────────────────────────────────
    const over = document.createElement('div');
    over.className = 'si-screen hidden';
    over.innerHTML = `
      <div class="si-glass si-panel">
        <h1 class="si-title" style="font-size:36px;" data-k="overTitle">GAME OVER</h1>
        <div class="si-sub" data-k="overSub">THE GRID HAS FALLEN</div>
        <div class="si-score-big" data-k="overScore">0</div>
        <div class="si-record hidden" data-k="record">★ NEW RECORD ★</div>
        <button class="si-btn" data-action="restart">Play Again</button>
        <button class="si-btn magenta" data-action="menu">Main Menu</button>
      </div>`;
    ui.appendChild(over);
    this.el.over = over;

    // ── Wire buttons ───────────────────────────────────────
    ui.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const cbs = this._listeners[action];
      if (cbs) for (const cb of cbs) cb();
    });

    this._built = true;
    return this;
  }

  /** Subscribe to a UI action: 'start' | 'resume' | 'restart' | 'menu'. */
  on(action, cb) {
    (this._listeners[action] ||= []).push(cb);
    return this;
  }

  _set(key, value) {
    const el = this.el && this.el.root.querySelector(`[data-k="${key}"]`);
    if (el) el.textContent = value;
  }

  /** Per-frame HUD refresh. */
  hud({ score, best, wave, lives, combo }) {
    if (!this._built) return;
    this._set('score', String(score));
    this._set('wave', String(wave));
    const glyphs = '▲'.repeat(Math.max(0, Math.min(lives, 5)));
    this._set('bestlives', `${best} · ${glyphs || '—'}`);
    const comboEl = this.el.root.querySelector('[data-k="combo"]');
    if (combo && combo >= 2) {
      comboEl.textContent = `×${combo} COMBO`;
      comboEl.classList.remove('hidden');
    } else {
      comboEl.classList.add('hidden');
    }
  }

  showScreen(name) {
    if (!this._built) return;
    for (const key of ['menu', 'pause', 'over']) {
      this.el[key].classList.toggle('hidden', key !== name);
    }
  }

  hideScreens() {
    if (!this._built) return;
    for (const key of ['menu', 'pause', 'over']) this.el[key].classList.add('hidden');
  }

  setGameOver({ score, best, newRecord, victory }) {
    if (!this._built) return;
    this._set('overTitle', victory ? 'SECTOR CLEARED' : 'GAME OVER');
    this._set('overSub', victory ? 'ALL WAVES REPELLED — FOR NOW' : 'THE GRID HAS FALLEN');
    this._set('overScore', String(score));
    const rec = this.el.root.querySelector('[data-k="record"]');
    if (rec) rec.classList.toggle('hidden', !newRecord);
  }

  dispose() {
    if (!this._built) return;
    this.el.root.remove();
    this._listeners = {};
    this._built = false;
  }
}
