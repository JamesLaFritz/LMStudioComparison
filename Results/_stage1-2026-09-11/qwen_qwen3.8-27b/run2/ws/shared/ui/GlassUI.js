/**
 * GlassUI — glassmorphism HUD + full-screen states (menu / pause / game over).
 *
 * Slot-based API so any game in the collection can drive it without touching
 * DOM structure:
 *
 *   ui.setHudSlot('score', '12 400');
 *   ui.showScreen('menu', { title: 'NEON INVADERS', lines: [...], primary: 'START' });
 *   ui.onPrimary = () => game.start();
 *
 * All DOM is created here and disposed on destroy() — no external markup.
 */

export class GlassUI {
  constructor(root) {
    this.root = root;
    this.onPrimary = null;
    this.onSecondary = null;

    this.hud = document.createElement('div');
    this.hud.className = 'glass-hud';
    this.slots = new Map();

    this.screen = document.createElement('div');
    this.screen.className = 'glass-screen';
    this.screen.hidden = true;

    this._buildHud();
    this._buildScreen();
    root.appendChild(this.hud);
    root.appendChild(this.screen);
  }

  _buildHud() {
    const left = document.createElement('div');
    left.className = 'hud-cluster hud-left';
    const right = document.createElement('div');
    right.className = 'hud-cluster hud-right';

    const mk = (label, cls) => {
      const el = document.createElement('div');
      el.className = `hud-slot ${cls}`;
      const lab = document.createElement('span');
      lab.className = 'hud-label';
      lab.textContent = label;
      const val = document.createElement('span');
      val.className = 'hud-value';
      el.append(lab, val);
      return { el, val };
    };

    const score = mk('SCORE', 'score');
    const wave = mk('WAVE', 'wave');
    const lives = mk('LIVES', 'lives');
    const combo = mk('COMBO', 'combo');
    combo.el.classList.add('combo-slot');
    combo.el.style.display = 'none';

    left.append(score.el, wave.el);
    right.append(lives.el, combo.el);
    this.hud.append(left, right);

    this.slots.set('score', score.val);
    this.slots.set('wave', wave.val);
    this.slots.set('lives', lives.val);
    this.slots.set('combo', combo.el);
  }

  _buildScreen() {
    this.screenTitle = document.createElement('h1');
    this.screenTitle.className = 'screen-title';

    this.screenSub = document.createElement('p');
    this.screenSub.className = 'screen-sub';

    this.screenLines = document.createElement('div');
    this.screenLines.className = 'screen-lines';

    this.btnPrimary = document.createElement('button');
    this.btnPrimary.className = 'glass-btn primary';
    this.btnPrimary.addEventListener('click', () => this.onPrimary && this.onPrimary());

    this.btnSecondary = document.createElement('button');
    this.btnSecondary.className = 'glass-btn';
    this.btnSecondary.addEventListener('click', () => this.onSecondary && this.onSecondary());

    this.screen.append(
      this.screenTitle,
      this.screenSub,
      this.screenLines,
      this.btnPrimary,
      this.btnSecondary
    );
  }

  setHudSlot(name, text) {
    const slot = this.slots.get(name);
    if (slot) slot.textContent = text;
  }

  setCombo(multiplier) {
    const el = this.slots.get('combo');
    if (!el) return;
    if (multiplier > 1) {
      el.style.display = '';
      el.querySelector('.hud-value').textContent = `×${multiplier}`;
    } else {
      el.style.display = 'none';
    }
  }

  showScreen(kind, opts = {}) {
    this.screen.hidden = false;
    this.screenTitle.textContent = opts.title || '';
    this.screenSub.textContent = opts.sub || '';

    this.screenLines.textContent = '';
    for (const line of opts.lines || []) {
      const p = document.createElement('p');
      p.textContent = line;
      this.screenLines.appendChild(p);
    }

    this.btnPrimary.textContent = opts.primary || 'START';
    this.btnPrimary.hidden = !opts.primary;
    this.btnSecondary.textContent = opts.secondary || '';
    this.btnSecondary.hidden = !opts.secondary;
    this.screen.dataset.kind = kind;
  }

  hideScreen() {
    this.screen.hidden = true;
  }

  hideHud() {
    this.hud.style.display = 'none';
  }

  showHud() {
    this.hud.style.display = '';
  }

  destroy() {
    this.hud.remove();
    this.screen.remove();
    this.slots.clear();
  }
}
