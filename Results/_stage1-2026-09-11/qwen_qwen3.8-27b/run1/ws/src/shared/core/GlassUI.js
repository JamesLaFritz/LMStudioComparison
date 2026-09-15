/**
 * GlassUI — glassmorphism design system with neon accents.
 * Injects one shared stylesheet, then provides DOM builders used by every
 * game's HUD and screens. All styling lives here so games stay consistent.
 */
const STYLE_ID = 'glassui-style';

const CSS = `
:root {
  --neon-cyan: #00f0ff;
  --neon-magenta: #ff2bd6;
  --neon-yellow: #ffd54a;
  --neon-green: #3dff9c;
  --neon-red: #ff3b5c;
  --glass-bg: rgba(10, 16, 32, 0.55);
  --glass-border: rgba(120, 220, 255, 0.22);
  --glass-hi: rgba(255, 255, 255, 0.08);
  --text-hi: #eaf6ff;
  --text-lo: rgba(190, 220, 245, 0.72);
}
.glass-root {
  position: absolute; inset: 0;
  pointer-events: none;
  font-family: "Segoe UI", "Inter", system-ui, sans-serif;
  color: var(--text-hi);
  overflow: hidden;
  z-index: 10;
}
.glass-panel {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--glass-hi);
}
.glass-hud {
  position: absolute; top: 14px; left: 14px; right: 14px;
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px;
}
.glass-hud .hud-block {
  padding: 10px 18px;
  display: flex; flex-direction: column; gap: 2px;
  min-width: 110px;
}
.hud-label {
  font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--text-lo);
}
.hud-value {
  font-size: 22px; font-weight: 700; letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 12px rgba(0, 240, 255, 0.55);
}
.hud-value.magenta { color: #ffd9f6; text-shadow: 0 0 12px rgba(255, 43, 214, 0.6); }
.hud-value.green { color: #d8ffe9; text-shadow: 0 0 12px rgba(61, 255, 156, 0.6); }
.hud-center { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.combo-meter {
  width: 180px; height: 8px; border-radius: 4px;
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--glass-border);
  overflow: hidden;
}
.combo-fill {
  height: 100%; width: 0%;
  background: linear-gradient(90deg, var(--neon-cyan), var(--neon-magenta));
  box-shadow: 0 0 10px var(--neon-cyan);
  transition: width 120ms linear;
}
.power-tags { display: flex; gap: 6px; }
.power-tag {
  padding: 3px 10px; border-radius: 8px;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 700;
  border: 1px solid var(--glass-border);
  background: rgba(0, 240, 255, 0.10);
  color: var(--text-hi);
  text-shadow: 0 0 8px currentColor;
}
.glass-screen {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, rgba(5,8,18,0.25) 0%, rgba(3,5,12,0.72) 100%);
  pointer-events: auto;
}
.glass-screen .screen-card {
  padding: 34px 46px;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  max-width: 560px; text-align: center;
}
.screen-title {
  font-size: 40px; font-weight: 800; letter-spacing: 0.18em;
  background: linear-gradient(90deg, var(--neon-cyan), var(--neon-magenta));
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 18px rgba(0, 240, 255, 0.45));
}
.screen-sub {
  font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--text-lo);
}
.screen-stats {
  display: flex; gap: 26px; margin-top: 6px;
}
.screen-stats .stat { display: flex; flex-direction: column; gap: 2px; }
.screen-stats .stat .hud-value { font-size: 26px; }
.glass-btn {
  pointer-events: auto;
  margin-top: 10px;
  padding: 12px 34px;
  font-size: 14px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--text-hi);
  background: linear-gradient(180deg, rgba(0,240,255,0.16), rgba(0,240,255,0.05));
  border: 1px solid rgba(0, 240, 255, 0.55);
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 0 18px rgba(0, 240, 255, 0.35), inset 0 1px 0 rgba(255,255,255,0.15);
  transition: transform 90ms ease, box-shadow 90ms ease;
}
.glass-btn:hover { transform: translateY(-1px); box-shadow: 0 0 26px rgba(0,240,255,0.6), inset 0 1px 0 rgba(255,255,255,0.2); }
.glass-btn:active { transform: translateY(1px); }
.glass-btn.magenta {
  border-color: rgba(255, 43, 214, 0.55);
  background: linear-gradient(180deg, rgba(255,43,214,0.16), rgba(255,43,214,0.05));
  box-shadow: 0 0 18px rgba(255,43,214,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
}
.key-hint {
  font-size: 11px; letter-spacing: 0.12em; color: var(--text-lo);
}
.key-hint b { color: var(--text-hi); font-weight: 700; }
.float-text {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: 15px; font-weight: 800; letter-spacing: 0.06em;
  padding: 3px 10px; border-radius: 8px;
  background: rgba(8, 14, 28, 0.55);
  border: 1px solid rgba(120, 220, 255, 0.25);
  backdrop-filter: blur(6px);
  white-space: nowrap;
  pointer-events: none;
  will-change: transform, opacity;
}
.flash-overlay {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, rgba(255,59,92,0.0) 40%, rgba(255,59,92,0.5) 100%);
  opacity: 0; pointer-events: none;
}
`;

export class GlassUI {
  /** Inject the shared stylesheet once per page. */
  static injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  /** Create the root overlay that owns all HUD/screen DOM. */
  static root(container) {
    GlassUI.injectStyles();
    const root = document.createElement('div');
    root.className = 'glass-root';
    container.appendChild(root);
    return root;
  }

  /** A glass panel element. */
  static panel(cls = '') {
    const el = document.createElement('div');
    el.className = `glass-panel ${cls}`.trim();
    return el;
  }

  /** HUD block: label + value. */
  static hudBlock(label, value, valueCls = '') {
    const el = GlassUI.panel('hud-block');
    const l = document.createElement('div');
    l.className = 'hud-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = `hud-value ${valueCls}`.trim();
    v.textContent = value;
    el.append(l, v);
    return el;
  }

  /** Full-screen overlay with a centered card. Returns { root, card }. */
  static screen(parent, { title, sub, stats = [], buttons = [] } = {}) {
    const root = document.createElement('div');
    root.className = 'glass-screen';
    const card = GlassUI.panel('screen-card');
    if (title) {
      const t = document.createElement('div');
      t.className = 'screen-title';
      t.textContent = title;
      card.appendChild(t);
    }
    if (sub) {
      const s = document.createElement('div');
      s.className = 'screen-sub';
      s.textContent = sub;
      card.appendChild(s);
    }
    if (stats.length) {
      const wrap = document.createElement('div');
      wrap.className = 'screen-stats';
      for (const st of stats) {
        const b = document.createElement('div');
        b.className = 'stat';
        const l = document.createElement('div');
        l.className = 'hud-label';
        l.textContent = st.label;
        const v = document.createElement('div');
        v.className = `hud-value ${st.cls || ''}`.trim();
        v.textContent = st.value;
        b.append(l, v);
        wrap.appendChild(b);
      }
      card.appendChild(wrap);
    }
    for (const btn of buttons) {
      const b = document.createElement('button');
      b.className = `glass-btn ${btn.cls || ''}`.trim();
      b.textContent = btn.label;
      if (btn.onClick) b.addEventListener('click', (e) => { e.stopPropagation(); btn.onClick(); });
      card.appendChild(b);
    }
    root.appendChild(card);
    parent.appendChild(root);
    return { root, card };
  }

  /** Hide a screen overlay (removes from DOM). */
  static hide(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  /** A floating score chip (used by FloatingText). */
  static floatChip(text, color) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.color = color;
    el.style.borderColor = color + '55';
    el.style.textShadow = `0 0 10px ${color}`;
    el.style.opacity = '0';
    return el;
  }

  /** Red damage flash overlay; call .flash(strength) to trigger. */
  static flashOverlay(parent) {
    const el = document.createElement('div');
    el.className = 'flash-overlay';
    parent.appendChild(el);
    let t = 0;
    return {
      el,
      flash(strength = 1) { t = strength; },
      update(dt) {
        if (t <= 0) { if (el.style.opacity !== '0') el.style.opacity = '0'; return; }
        t = Math.max(0, t - dt * 2.2);
        el.style.opacity = String(t);
      },
    };
  }
}
