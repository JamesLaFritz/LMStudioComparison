/**
 * Modal overlay manager.
 *
 * Owns the title, pause, game-over and error panels. One layer, reused — panels
 * are rebuilt in place rather than created and destroyed, so opening a pause
 * menu costs a few DOM writes rather than a full subtree construction and
 * style pass.
 *
 * ### Input handover
 *
 * Opening an overlay suspends gameplay input and focuses the primary action.
 * This matters more than it looks:
 *
 *  - Without suspension, a player holding *fire* when they hit pause is still
 *    holding fire when they unpause, and the game reads a `pressed` edge that
 *    never happened.
 *  - Without focus management the panel is unreachable by keyboard, which makes
 *    the whole game unplayable for anyone not using a mouse.
 *  - Focus is *restored* on close so that dismissing a menu does not leave the
 *    keyboard focus stranded on a removed node, which silently breaks every
 *    subsequent Tab press.
 */
export class Overlay {
  /**
   * @param {HTMLElement} root
   * @param {object} [opts]
   * @param {(suspended:boolean) => void} [opts.onInputSuspend]
   */
  constructor(root, { onInputSuspend = null } = {}) {
    this.root = root;
    this.onInputSuspend = onInputSuspend;

    this.layer = document.createElement('div');
    this.layer.className = 'overlay-layer';
    this.layer.setAttribute('role', 'dialog');
    this.layer.setAttribute('aria-modal', 'true');
    this.layer.setAttribute('aria-hidden', 'true');

    this.panel = document.createElement('div');
    this.panel.className = 'overlay-panel';
    this.layer.appendChild(this.panel);

    root.appendChild(this.layer);

    this.visible = false;
    /** @type {HTMLElement|null} element focused before the overlay opened */
    this._returnFocus = null;
    /** @type {string} identifies the currently shown panel */
    this.currentId = '';

    this._onKeyDown = this._onKeyDown.bind(this);
  }

  /**
   * Show a panel.
   *
   * @param {object} spec
   * @param {string}  spec.id        used to avoid rebuilding an identical panel
   * @param {string}  spec.title
   * @param {string}  [spec.titleClass]
   * @param {string}  [spec.subtitle]
   * @param {string}  [spec.body]    plain text, inserted as textContent
   * @param {Array<{label:string, value:string|number, className?:string}>} [spec.stats]
   * @param {Array<{label:string, onSelect:Function, primary?:boolean, ghost?:boolean}>} [spec.actions]
   * @param {Array<{label:string, get:()=>boolean, toggle:()=>void}>} [spec.options]
   */
  show(spec) {
    const {
      id = 'panel',
      title = '',
      titleClass = 'neon',
      subtitle = '',
      body = '',
      stats = null,
      actions = null,
      options = null
    } = spec;

    // Rebuild only when the panel identity changes; a pause menu reopened with
    // the same id just re-reveals the existing DOM.
    if (this.currentId !== id) {
      this._build({ title, titleClass, subtitle, body, stats, actions, options });
      this.currentId = id;
    } else {
      this._refreshStats(stats);
      this._refreshOptions(options);
    }

    if (!this.visible) {
      this.visible = true;
      this._returnFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

      this.layer.classList.add('overlay-layer--visible');
      this.layer.setAttribute('aria-hidden', 'false');
      document.addEventListener('keydown', this._onKeyDown, true);

      if (this.onInputSuspend) this.onInputSuspend(true);

      // Focus the primary action so Enter and Space work immediately, and so
      // screen readers announce the panel.
      const primary = this.panel.querySelector('.btn--primary') || this.panel.querySelector('.btn');
      if (primary) primary.focus({ preventScroll: true });
    }
  }

  _build({ title, titleClass, subtitle, body, stats, actions, options }) {
    // `replaceChildren` clears in one operation rather than N removals, each of
    // which would otherwise trigger its own mutation bookkeeping.
    this.panel.replaceChildren();

    if (title) {
      const h = document.createElement('h1');
      h.className = `overlay-title ${titleClass}`;
      h.textContent = title;
      this.panel.appendChild(h);
    }

    if (subtitle) {
      const s = document.createElement('p');
      s.className = 'overlay-subtitle';
      s.textContent = subtitle;
      this.panel.appendChild(s);
    }

    if (body) {
      const b = document.createElement('p');
      b.className = 'overlay-body';
      // textContent, never innerHTML — this string can carry a score or an
      // error message, and neither is a place to open an injection hole.
      b.textContent = body;
      this.panel.appendChild(b);
    }

    if (stats && stats.length > 0) {
      const wrap = document.createElement('div');
      wrap.className = 'overlay-stats';
      for (const stat of stats) {
        const item = document.createElement('div');
        item.className = 'overlay-stat';

        const label = document.createElement('span');
        label.className = 'overlay-stat__label';
        label.textContent = stat.label;

        const value = document.createElement('span');
        value.className = `overlay-stat__value tabular ${stat.className || 'neon'}`;
        value.textContent = String(stat.value);
        value.dataset.statLabel = stat.label;

        item.append(label, value);
        wrap.appendChild(item);
      }
      this.panel.appendChild(wrap);
      this._statsWrap = wrap;
    } else {
      this._statsWrap = null;
    }

    if (options && options.length > 0) {
      const wrap = document.createElement('div');
      wrap.className = 'overlay-options';
      for (const option of options) {
        const row = document.createElement('div');
        row.className = 'option-row';

        const label = document.createElement('span');
        label.textContent = option.label;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'option-toggle';
        const sync = () => {
          const on = option.get();
          toggle.textContent = on ? 'ON' : 'OFF';
          toggle.dataset.on = String(on);
          toggle.setAttribute('aria-pressed', String(on));
        };
        sync();
        toggle.addEventListener('click', () => {
          option.toggle();
          sync();
        });
        option._sync = sync;

        row.append(label, toggle);
        wrap.appendChild(row);
      }
      this.panel.appendChild(wrap);
      this._options = options;
    } else {
      this._options = null;
    }

    if (actions && actions.length > 0) {
      const wrap = document.createElement('div');
      wrap.className = 'overlay-actions';
      for (const action of actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn${action.primary ? ' btn--primary' : ''}${
          action.ghost ? ' btn--ghost' : ''
        }`;
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
          action.onSelect();
        });
        wrap.appendChild(btn);
      }
      this.panel.appendChild(wrap);
    }
  }

  _refreshStats(stats) {
    if (!stats || !this._statsWrap) return;
    for (const stat of stats) {
      const el = this._statsWrap.querySelector(
        `[data-stat-label="${CSS.escape(stat.label)}"]`
      );
      if (el && el.textContent !== String(stat.value)) {
        el.textContent = String(stat.value);
      }
    }
  }

  _refreshOptions(options) {
    if (!options || !this._options) return;
    for (const option of this._options) {
      if (option._sync) option._sync();
    }
  }

  /**
   * Keyboard handling while a modal is open.
   *
   * Captured at the document level so it runs before the game's own handlers,
   * and Tab is trapped inside the panel — a modal that lets focus escape into
   * the page behind it is a modal in appearance only.
   */
  _onKeyDown(event) {
    if (!this.visible) return;

    if (event.key === 'Tab') {
      const focusable = this.panel.querySelectorAll('button:not([disabled])');
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    // Arrow keys move between actions, so a gamepad-style player on the
    // keyboard does not have to discover that Tab is the navigation key.
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const focusable = [...this.panel.querySelectorAll('button:not([disabled])')];
      if (focusable.length < 2) return;
      const index = focusable.indexOf(document.activeElement);
      if (index === -1) return;
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = (index + delta + focusable.length) % focusable.length;
      focusable[next].focus();
    }
  }

  /** Hide the overlay and restore input and focus. */
  hide() {
    if (!this.visible) return;
    this.visible = false;

    this.layer.classList.remove('overlay-layer--visible');
    this.layer.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', this._onKeyDown, true);

    if (this.onInputSuspend) this.onInputSuspend(false);

    if (this._returnFocus && document.contains(this._returnFocus)) {
      this._returnFocus.focus({ preventScroll: true });
    } else if (document.activeElement instanceof HTMLElement) {
      // Blur whatever is focused inside the panel so a subsequent key press is
      // not swallowed by a now-invisible button.
      document.activeElement.blur();
    }
    this._returnFocus = null;
  }

  /** Hide without resetting `currentId`, so the same panel can be re-shown. */
  isShowing(id) {
    return this.visible && this.currentId === id;
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown, true);
    if (this.layer.parentNode) this.layer.parentNode.removeChild(this.layer);
    this._returnFocus = null;
    this._options = null;
    this._statsWrap = null;
  }
}
