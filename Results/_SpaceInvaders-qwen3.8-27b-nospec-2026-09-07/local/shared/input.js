// shared/input.js — unified dual-input controller (Keyboard + Gamepad API).
//
// One InputController per game. Games read normalized state:
//   axes: { x, y }        — -1..1, x right+, y up+ (gamepad stick or WASD)
//   buttons: { left, right, up, down, fire, jump, pause, ... }
//   pressed(name)         — edge-triggered, true once per press this frame
// Keyboard always wins on conflict; gamepad fills gaps (dual-input merge).

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'fire', KeyJ: 'fire', KeyZ: 'fire',
  KeyK: 'jump', KeyL: 'jump', ShiftLeft: 'jump',
  Enter: 'confirm', KeyE: 'confirm',
  Escape: 'pause', KeyP: 'pause',
  KeyR: 'restart',
};

const PAD_BUTTONS = {
  0: 'fire',      // A / cross
  1: 'jump',      // B / circle
  2: 'confirm',   // X / square
  3: 'pause',     // Y / triangle
  4: 'left',      // LB
  5: 'right',     // RB
  9: 'pause',     // start
};

export class InputController {
  constructor() {
    this.axes = { x: 0, y: 0 };
    this.buttons = {};
    this._pressed = new Set();
    this._keys = new Set();
    this._padConnected = false;
    this._padIndex = -1;

    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    this._onPadConn = (e) => {
      if (e.connected) this._padIndex = e.port?.gamepad?.index ?? -1;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('gamepadconnected', this._onPadConn);
    window.addEventListener('gamepaddisconnected', this._onPadConn);
  }

  _key(e, down) {
    const name = KEY_MAP[e.code];
    if (!name) return;
    if (down) {
      if (!this._keys.has(e.code)) this._pressed.add(name);
      this._keys.add(e.code);
      this.buttons[name] = true;
    } else {
      this._keys.delete(e.code);
      // Only clear if no other key still holds this action.
      const held = Object.keys(KEY_MAP).some((c) => KEY_MAP[c] === name && this._keys.has(c));
      if (!held) this.buttons[name] = false;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }

  /** Poll gamepads; call once per frame BEFORE reading state. */
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    this._padConnected = !!pad;
    if (!pad) return;

    // D-pad (buttons 12-15) + left stick
    const dz = (b) => (pad.buttons[b]?.pressed ? 1 : 0);
    const lx = pad.axes[0] ?? 0;
    const ly = pad.axes[1] ?? 0;
    const dead = (v) => (Math.abs(v) < 0.18 ? 0 : v);

    const padX = dead(lx) || (dz(15) - dz(14));
    const padY = dead(ly) || (dz(13) - dz(12));

    // Keyboard wins on conflict: only apply pad axis if no key holds that side.
    const keyH = (names) => names.some((n) => this.buttons[n]);
    if (padX !== 0 && !keyH(['left', 'right'])) this.axes.x = padX;
    if (padY !== 0 && !keyH(['up', 'down'])) this.axes.y = padY;

    for (const [idx, name] of Object.entries(PAD_BUTTONS)) {
      if (pad.buttons[Number(idx)]?.pressed) {
        if (!this.buttons[name]) this._pressed.add(name);
        this.buttons[name] = true;
      }
    }
  }

  /** Edge-triggered: true exactly once per press. Call after poll(). */
  pressed(name) { return this._pressed.has(name); }

  /** Clear edge triggers — call at the END of the frame. */
  endFrame() { this._pressed.clear(); }

  /** Keyboard-only axis (for games where gamepad stick would double-drive). */
  keyAxis() {
    const x = (this.buttons.right ? 1 : 0) - (this.buttons.left ? 1 : 0);
    const y = (this.buttons.up ? 1 : 0) - (this.buttons.down ? 1 : 0);
    return { x, y };
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('gamepadconnected', this._onPadConn);
    window.removeEventListener('gamepaddisconnected', this._onPadConn);
  }
}
