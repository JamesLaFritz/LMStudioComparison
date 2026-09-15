/**
 * GlassUI — glassmorphism panel factory + neon design tokens.
 *
 * Injects a single shared stylesheet (idempotent) and builds DOM panels with
 * the glass/neon design system. Panels are plain DOM so they can host any
 * content; the game layer owns their lifecycle.
 */

const TOKEN_ID = 'glass-ui-tokens';

const TOKEN_CSS = `
:root {
  --glass-bg: rgba(10, 14, 28, 0.55);
  --glass-border: rgba(120, 220, 255, 0.22);
  --glass-hi: rgba(255, 255, 255, 0.08);
  --neon-cyan: #35f0ff;
  --neon-magenta: #ff3df0;
  --neon-gold: #ffd23d;
  --neon-green: #4dffa6;
  --neon-red: #ff4d6d;
  --text-hi: #eaf6ff;
  --text-lo: #9fb8d8;
  --font-display: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'Cascadia Code', 'Consolas', 'SF Mono', monospace;
}
.glass-panel {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 22px;
  border-radius: 18px;
  background: linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 38%), var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.25),
    0 18px 50px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 var(--glass-hi);
  backdrop-filter: blur(14px) saturate(1.35);
  -webkit-backdrop-filter: blur(14px) saturate(1.35);
  color: var(--text-hi);
  font-family: var(--font-display);
  user-select: none;
  z-index: 20;
}
.glass-panel .gp-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--neon-cyan);
  text-shadow: 0 0 12px rgba(53, 240, 255, 0.8);
}
.glass-panel .gp-stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18px;
  font-size: 14px;
  color: var(--text-lo);
  letter-spacing: 0.08em;
}
.glass-panel .gp-stat b {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-hi);
  text-shadow: 0 0 10px rgba(53, 240, 255, 0.55);
}
.glass-btn {
  appearance: none;
  border: 1px solid var(--glass-border);
  background: linear-gradient(180deg, rgba(53,240,255,0.16), rgba(53,240,255,0.04));
  color: var(--text-hi);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  padding: 12px 26px;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
  box-shadow: 0 0 18px rgba(53, 240, 255, 0.18), inset 0 1px 0 var(--glass-hi);
}
.glass-btn:hover {
  transform: translateY(-1px);
  background: linear-gradient(180deg, rgba(53,240,255,0.28), rgba(53,240,255,0.08));
  box-shadow: 0 0 26px rgba(53, 240, 255, 0.4), inset 0 1px 0 var(--glass-hi);
}
.glass-btn:active { transform: translateY(1px) scale(0.99); }
.glass-btn.glow-magenta {
  border-color: rgba(255, 61, 240, 0.35);
  background: linear-gradient(180deg, rgba(255,61,240,0.20), rgba(255,61,240,0.05));
  box-shadow: 0 0 18px rgba(255, 61, 240, 0.25), inset 0 1px 0 var(--glass-hi);
}
.glass-btn.glow-magenta:hover { box-shadow: 0 0 28px rgba(255, 61, 240, 0.5); }
.glass-hint {
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--text-lo);
  text-align: center;
}
.glass-hidden { display: none !important; }
`;

function ensureTokens() {
  if (document.getElementById(TOKEN_ID)) return;
  const style = document.createElement('style');
  style.id = TOKEN_ID;
  style.textContent = TOKEN_CSS;
  document.head.appendChild(style);
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.parent  container to attach the panel to
 * @param {string} [opts.title]
 * @param {string} [opts.position]  CSS position value (default 'top')
 * @param {object} [opts.style]     extra CSS properties
 */
export class GlassUI {
  constructor(opts = {}) {
    ensureTokens();
    const parent = opts.parent || document.body;
    this.panel = document.createElement('div');
    this.panel.className = 'glass-panel';
    if (opts.title) {
      const t = document.createElement('div');
      t.className = 'gp-title';
      t.textContent = opts.title;
      this.panel.appendChild(t);
    }
    const pos = opts.position || 'top';
    this.panel.style.left = '50%';
    this.panel.style.transform = 'translateX(-50%)';
    if (pos === 'top') this.panel.style.top = '18px';
    else if (pos === 'bottom') { this.panel.style.bottom = '18px'; this.panel.style.top = 'auto'; }
    else if (pos === 'center') { this.panel.style.top = '50%'; this.panel.style.transform = 'translate(-50%, -50%)'; }
    else if (pos === 'left') { this.panel.style.left = '18px'; this.panel.style.transform = 'none'; }
    else if (pos === 'right') { this.panel.style.right = '18px'; this.panel.style.left = 'auto'; this.panel.style.transform = 'none'; }
    if (opts.style) Object.assign(this.panel.style, opts.style);
    parent.appendChild(this.panel);
    this._statRows = new Map();
  }

  /** Add or update a labeled stat row. Returns the value element. */
  setStat(label, value) {
    let row = this._statRows.get(label);
    if (!row) {
      row = document.createElement('div');
      row.className = 'gp-stat';
      const k = document.createElement('span');
      k.textContent = label;
      const v = document.createElement('b');
      row.appendChild(k);
      row.appendChild(v);
      this.panel.appendChild(row);
      this._statRows.set(label, row);
    }
    row.querySelector('b').textContent = String(value);
    return row.querySelector('b');
  }

  /** Append an arbitrary child element. */
  add(el) { this.panel.appendChild(el); return el; }

  /** Append a neon button; returns the element. */
  button(label, onClick, cls = '') {
    const b = document.createElement('button');
    b.className = 'glass-btn ' + cls;
    b.textContent = label;
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick && onClick(e); });
    this.panel.appendChild(b);
    return b;
  }

  hint(text) {
    const h = document.createElement('div');
    h.className = 'glass-hint';
    h.textContent = text;
    this.panel.appendChild(h);
    return h;
  }

  show() { this.panel.classList.remove('glass-hidden'); }
  hide() { this.panel.classList.add('glass-hidden'); }
  get visible() { return !this.panel.classList.contains('glass-hidden'); }

  dispose() {
    this._statRows.clear();
    if (this.panel.parentNode) this.panel.parentNode.removeChild(this.panel);
  }
}

export default GlassUI;
