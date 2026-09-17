// Glass menu screens (title / pause / results) navigable with keyboard, gamepad and mouse.
// One screen at a time; `update()` must be called every frame while a screen is visible.
import { Actions } from '../input/InputManager.js';
import { el } from './UIOverlay.js';

export class MenuSystem {
  /**
   * @param {import('./UIOverlay.js').UIOverlay} overlay
   * @param {import('../input/InputManager.js').InputManager} input
   */
  constructor(overlay, input) {
    this.overlay = overlay;
    this.input = input;
    this.visible = false;
    this.index = 0;
    this.items = [];
    this.spec = null;
    this.onNavigate = null;
    this.onSelect = null;
    this._holdCooldown = 0;

    this.screen = el('div', 'menu-screen hidden');
    overlay.root.appendChild(this.screen);
  }

  /**
   * @param {object} spec
   * @param {string} spec.title
   * @param {string} [spec.titleClass]   colour class: magenta | lime | red | amber
   * @param {string} [spec.eyebrow]
   * @param {string} [spec.subtitle]
   * @param {string|HTMLElement} [spec.body]
   * @param {Array<{label:string, action:Function}>} spec.items
   * @param {string|HTMLElement} [spec.footer]
   * @param {Function} [spec.onBack]
   */
  show(spec) {
    this.spec = spec;
    this.index = 0;
    this.items = [];
    this.screen.replaceChildren();

    const card = el('div', 'glass-panel strong menu-card');
    if (spec.eyebrow) card.appendChild(el('div', 'menu-eyebrow', spec.eyebrow));
    card.appendChild(el('h1', `menu-title${spec.titleClass ? ' ' + spec.titleClass : ''}`, spec.title));
    if (spec.subtitle) card.appendChild(el('div', 'menu-subtitle', spec.subtitle));
    if (spec.body) {
      if (typeof spec.body === 'string') {
        const body = el('div', 'menu-body');
        body.textContent = spec.body;
        card.appendChild(body);
      } else {
        card.appendChild(spec.body);
      }
    }

    const list = el('div', 'menu-items');
    spec.items.forEach((item, i) => {
      const node = el('div', 'menu-item', item.label);
      node.addEventListener('mouseenter', () => {
        if (this.index !== i) {
          this.index = i;
          this._highlight();
          if (this.onNavigate) this.onNavigate();
        }
      });
      node.addEventListener('click', () => this._activate(i));
      list.appendChild(node);
      this.items.push({ node, action: item.action });
    });
    card.appendChild(list);

    if (spec.footer) {
      const footer = el('div', 'menu-footer');
      if (typeof spec.footer === 'string') footer.innerHTML = spec.footer;
      else footer.appendChild(spec.footer);
      card.appendChild(footer);
    }

    this.screen.appendChild(card);
    this.screen.classList.remove('hidden');
    this.visible = true;
    this._highlight();
    this.input.flush();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.screen.classList.add('hidden');
    this.screen.replaceChildren();
    this.items = [];
    this.spec = null;
    this.input.flush();
  }

  _highlight() {
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].node.classList.toggle('active', i === this.index);
    }
  }

  _activate(i) {
    if (!this.visible) return;
    const item = this.items[i];
    if (!item) return;
    if (this.onSelect) this.onSelect();
    item.action();
  }

  update(realDt = 0) {
    if (!this.visible) return;
    const input = this.input;
    const count = this.items.length;

    // Digital navigation with edge detection plus a slow auto-repeat while held.
    let dir = 0;
    if (input.pressed(Actions.DOWN)) dir = 1;
    else if (input.pressed(Actions.UP)) dir = -1;
    else if (input.held(Actions.DOWN) || input.held(Actions.UP)) {
      this._holdCooldown -= realDt;
      if (this._holdCooldown <= 0) {
        dir = input.held(Actions.DOWN) ? 1 : -1;
        this._holdCooldown = 0.12;
      }
    }
    if (!input.held(Actions.DOWN) && !input.held(Actions.UP)) this._holdCooldown = 0.35;

    if (dir !== 0 && count > 1) {
      this.index = (this.index + dir + count) % count;
      this._highlight();
      if (this.onNavigate) this.onNavigate();
    }

    if (input.pressed(Actions.CONFIRM) || input.pressed(Actions.FIRE)) {
      this._activate(this.index);
      return;
    }
    if (input.pressed(Actions.BACK) && this.spec && this.spec.onBack) {
      this.spec.onBack();
    }
  }

  dispose() {
    this.hide();
    this.screen.remove();
  }
}
