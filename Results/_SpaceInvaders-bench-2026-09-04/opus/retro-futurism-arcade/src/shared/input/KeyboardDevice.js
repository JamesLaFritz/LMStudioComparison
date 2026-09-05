import { collectBoundKeys } from './ActionMap.js';

/**
 * Keyboard state tracker.
 *
 * Reports a raw key-down set; edge detection and action mapping happen one
 * layer up in `InputManager`, so the same edge logic serves both devices.
 *
 * ### Three details that matter more than they look
 *
 * 1. **`preventDefault` only on bound keys.** Space scrolls the page, arrows
 *    scroll the page, and F-keys open browser panels. But blanket-preventing
 *    everything breaks Tab navigation and browser shortcuts, which is hostile.
 *    Only keys the game actually consumes are swallowed.
 *
 * 2. **Modifier chords pass through.** `Ctrl+R`, `Cmd+Shift+I`, `Alt+Tab` must
 *    keep working. A game that eats the reload shortcut is infuriating, and
 *    checking the modifier flags is the entire fix.
 *
 * 3. **`blur` clears every key.** If the player alt-tabs mid-move, the `keyup`
 *    is delivered to the other window and never arrives here — the ship would
 *    keep drifting forever on return. Clearing on blur is not defensive
 *    programming, it is the only correct behaviour.
 */
export class KeyboardDevice {
  /**
   * @param {object} [opts]
   * @param {EventTarget} [opts.target]
   * @param {import('./ActionMap.js').DEFAULT_BINDINGS} [opts.bindings]
   */
  constructor(opts = {}) {
    const { target = window, bindings = null } = opts;

    this.target = target;
    /** @type {Set<string>} currently held `KeyboardEvent.code` values */
    this.down = new Set();
    /** Keys the game consumes, and therefore swallows. */
    this.consumed = bindings ? collectBoundKeys(bindings) : collectBoundKeys();

    /** True on any frame where a key event was seen; drives device auto-detect. */
    this.activity = false;
    this.enabled = true;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);

    target.addEventListener('keydown', this._onKeyDown, { passive: false });
    target.addEventListener('keyup', this._onKeyUp, { passive: false });
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('contextmenu', this._onContextMenu);
  }

  _onKeyDown(event) {
    if (!this.enabled) return;

    // Never intercept a browser or OS chord.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    // Ignore auto-repeat: holding a key must not re-fire a `pressed` edge.
    if (event.repeat) {
      if (this.consumed.has(event.code)) event.preventDefault();
      return;
    }

    this.down.add(event.code);
    this.activity = true;

    if (this.consumed.has(event.code)) event.preventDefault();
  }

  _onKeyUp(event) {
    this.down.delete(event.code);
    if (this.consumed.has(event.code)) event.preventDefault();
  }

  _onBlur() {
    // See class comment — this is a correctness fix, not a nicety.
    this.down.clear();
  }

  _onContextMenu() {
    // A right-click context menu steals focus without firing blur in some
    // browsers, stranding held keys in exactly the same way.
    this.down.clear();
  }

  /** True while `code` is held. */
  isDown(code) {
    return this.down.has(code);
  }

  /** True if any of the supplied codes is held. */
  anyDown(codes) {
    for (let i = 0; i < codes.length; i++) {
      if (this.down.has(codes[i])) return true;
    }
    return false;
  }

  /** Called by `InputManager` at the end of each poll. */
  clearActivity() {
    this.activity = false;
  }

  /** Release everything. Used when a modal overlay takes input focus. */
  reset() {
    this.down.clear();
    this.activity = false;
  }

  dispose() {
    this.target.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('contextmenu', this._onContextMenu);
    this.down.clear();
  }
}
