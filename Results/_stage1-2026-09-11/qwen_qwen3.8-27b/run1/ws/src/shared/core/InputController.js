/**
 * InputController — unified keyboard + Gamepad input.
 *
 * Merges both sources into a single logical action set. Keyboard maps:
 *   left/right  ← A/D or ArrowLeft/ArrowRight
 *   fire        ← Space or Z
 *   pause       ← P or Escape
 *   start       ← Enter
 * Gamepad (first connected):
 *   left/right  ← left stick X (deadzone 0.18) or D-pad
 *   fire        ← button 0 (A) or button 2 (X)
 *   pause/start ← button 9 (Start)
 *
 * `pressed(name)` is a rising-edge query: it returns true once per press and
 * clears on the next poll, so callers can act on discrete taps.
 */
const KEY_MAP = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'fire', KeyZ: 'fire',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'start',
};

export class InputController {
  constructor() {
    this._keys = new Set();
    this._pending = new Set();   // edges accumulated since last poll (keyboard + gamepad)
    this._pressed = new Set();   // committed edges, readable via pressed()
    this._gamepad = null;
    this._prevButtons = new Set();
    this.gamepadConnected = false;

    this._onKeyDown = (e) => {
      const a = KEY_MAP[e.code];
      if (!a) return;
      if (!this._keys.has(a)) this._pending.add(a);
      this._keys.add(a);
      if (a === 'fire' || a === 'start') e.preventDefault();
    };
    this._onKeyUp = (e) => {
      const a = KEY_MAP[e.code];
      if (a) this._keys.delete(a);
    };
    this._onPadConnect = (e) => {
      this._gamepad = e.gamepad;
      this.gamepadConnected = true;
      this._prevButtons.clear();
    };
    this._onPadDisconnect = (e) => {
      if (this._gamepad === e.gamepad) {
        this._gamepad = null;
        this.gamepadConnected = false;
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('gamepadconnected', this._onPadConnect);
    window.addEventListener('gamepaddisconnected', this._onPadDisconnect);
  }

  /** Call once per frame before reading state. */
  poll() {
    // Commit edges accumulated since the last poll (keyboard + gamepad),
    // then clear the pending set so each press reads as exactly one edge.
    this._pressed.clear();
    for (const a of this._pending) this._pressed.add(a);
    this._pending.clear();

    const gp = this._gamepad || this._pollGamepads();
    if (gp && gp.buttons) {
      const now = new Set();
      for (let i = 0; i < gp.buttons.length; i++) {
        if (gp.buttons[i].pressed) now.add(i);
      }
      // Rising edges from gamepad → logical actions.
      for (const i of now) {
        if (!this._prevButtons.has(i)) {
          if (i === 0 || i === 2) this._pressed.add('fire');
          if (i === 9) { this._pressed.add('pause'); this._pressed.add('start'); }
        }
      }
      this._prevButtons = now;
    }
  }

  _pollGamepads() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (const p of pads) {
      if (p && p.connected) {
        this._gamepad = p;
        this.gamepadConnected = true;
        return p;
      }
    }
    return null;
  }

  /** Normalized horizontal axis in [-1, 1]. */
  axisX() {
    let v = 0;
    if (this._keys.has('left')) v -= 1;
    if (this._keys.has('right')) v += 1;
    const gp = this._gamepad;
    if (gp && gp.axes && gp.axes.length > 0) {
      const gx = gp.axes[0] || 0;
      if (Math.abs(gx) > 0.18) v = gx;
      if (gp.buttons) {
        if (gp.buttons[14] && gp.buttons[14].pressed) v = -1;
        if (gp.buttons[15] && gp.buttons[15].pressed) v = 1;
      }
    }
    return Math.max(-1, Math.min(1, v));
  }

  /** Level (held) state of a logical action. */
  button(name) {
    if (this._keys.has(name)) return true;
    const gp = this._gamepad;
    if (gp && gp.buttons) {
      if (name === 'fire' && (gp.buttons[0]?.pressed || gp.buttons[2]?.pressed)) return true;
      if (name === 'pause' && gp.buttons[9]?.pressed) return true;
      if (name === 'start' && gp.buttons[9]?.pressed) return true;
    }
    return false;
  }

  /** Rising-edge state of a logical action (true once per press). */
  pressed(name) {
    return this._pressed.has(name);
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('gamepadconnected', this._onPadConnect);
    window.removeEventListener('gamepaddisconnected', this._onPadDisconnect);
    this._keys.clear();
    this._pressed.clear();
  }
}
