/**
 * InputController — unified dual-input (Keyboard + Gamepad) state source.
 *
 * One normalized state object per frame:
 *   moveX      -1..+1  (gamepad axis wins when beyond deadzone, else keyboard)
 *   fireHeld   boolean (analog-aware: any of the mapped triggers/buttons held)
 *   consume(n) edge-triggered events: 'fire' | 'pause' | 'start' — true exactly once per press
 *
 * update() is called once per animation frame by Engine; game code reads state
 * inside its fixed-timestep updates. No per-frame allocations beyond the two
 * small scratch structures created at construction.
 */

const DEADZONE = 0.18;

const KEY_LEFT = new Set(['ArrowLeft', 'KeyA']);
const KEY_RIGHT = new Set(['ArrowRight', 'KeyD']);
const KEY_FIRE = new Set(['Space', 'KeyJ', 'KeyZ']);
const KEY_PAUSE = new Set(['Escape', 'KeyP']);
const KEY_START = new Set(['Enter', 'KeyK']);

export class InputController {
  constructor(target) {
    this._target = target || window;
    this._keys = Object.create(null); // code -> bool (held)
    this._gamepadIndex = -1;
    this._prevFireHeld = false;
    this._prevPauseHeld = false;
    this._prevStartHeld = false;

    /** Normalized per-frame state. */
    this.state = { moveX: 0, fireHeld: false };
    /** Edge events pressed since last consume(). */
    this._pressed = new Set();
    /** True if any mapped control was touched (used to unlock audio). */
    this.touched = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._target.addEventListener('keydown', this._onKeyDown, { passive: false });
    this._target.addEventListener('keyup', this._onKeyUp, { passive: true });
    window.addEventListener('blur', this._onBlur);
  }

  _onKeyDown(e) {
    if (KEY_LEFT.has(e.code) || KEY_RIGHT.has(e.code) || KEY_FIRE.has(e.code)) e.preventDefault();
    const wasHeld = !!this._keys[e.code];
    this._keys[e.code] = true;
    this.touched = true;
    if (!wasHeld) {
      if (KEY_FIRE.has(e.code)) this._pressed.add('fire');
      else if (KEY_PAUSE.has(e.code)) this._pressed.add('pause');
      else if (KEY_START.has(e.code)) this._pressed.add('start');
    }
  }

  _onKeyUp(e) {
    this._keys[e.code] = false;
  }

  _onBlur() {
    for (const code in this._keys) this._keys[code] = false;
  }

  consume(name) {
    if (this._pressed.has(name)) {
      this._pressed.delete(name);
      return true;
    }
    return false;
  }

  /** Haptic pulse — feature-detected, safe to call unconditionally. */
  vibrate(strongMagnitude, durationMs) {
    const gp = this._activeGamepad();
    if (gp && gp.vibrationActuator && typeof gp.vibrationActuator.playEffect === 'function') {
      try {
        gp.vibrationActuator.playEffect('dual-rumble', {
          strongMagnitude,
          weakMagnitude: strongMagnitude * 0.6,
          duration: Math.min(durationMs, 500),
        });
      } catch (_) { /* unsupported effect — ignore */ }
    }
  }

  _activeGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) if (pads[i]) return pads[i];
    return null;
  }

  /** Called once per frame by Engine before the fixed-timestep updates. */
  update() {
    // --- keyboard axis ---
    let kb = 0;
    for (const code in this._keys) {
      if (!this._keys[code]) continue;
      if (KEY_LEFT.has(code)) kb -= 1;
      else if (KEY_RIGHT.has(code)) kb += 1;
    }

    // --- gamepad: axis + buttons (analog where available) ---
    const gp = this._activeGamepad();
    let gpAxis = 0;
    let gpFire = false;
    let gpPause = false;
    let gpStart = false;
    if (gp) {
      this._gamepadIndex = gp.index !== undefined ? gp.index : this._gamepadIndex;
      const ax = gp.axes && gp.axes[0] || 0;
      if (Math.abs(ax) > DEADZONE) gpAxis = Math.max(-1, Math.min(1, ax / 0.75));
      const b = gp.buttons;
      for (let i = 0; i < b.length && i < 12; i++) {
        if (!b[i]) continue;
        const v = b[i].value !== undefined ? b[i].value : (b[i].pressed ? 1 : 0);
        if ((i === 0 || i === 2) && v > DEADZONE) gpFire = true; // A / X fire
        else if (i === 1 && v > DEADZONE) gpPause = true;       // B pause
        else if (i === 9 && b[i].pressed) gpStart = true;      // Start
      }
    }

    const kbFire = this._anyKey(KEY_FIRE);
    const kbPause = this._anyKey(KEY_PAUSE);
    const kbStart = this._anyKey(KEY_START);

    this.state.moveX = Math.abs(gpAxis) >= Math.abs(kb) ? gpAxis : kb;
    this.state.fireHeld = gpFire || kbFire;

    // --- edge detection on held signals (keyboard + gamepad) ---
    const fireHeld = gpFire || kbFire;
    const pauseHeld = gpPause || kbPause;
    const startHeld = gpStart || kbStart;
    if (fireHeld && !this._prevFireHeld) this._pressed.add('fire');
    if (pauseHeld && !this._prevPauseHeld) this._pressed.add('pause');
    if (startHeld && !this._prevStartHeld) this._pressed.add('start');

    if (fireHeld || pauseHeld || startHeld) this.touched = true;
    this._prevFireHeld = fireHeld;
    this._prevPauseHeld = pauseHeld;
    this._prevStartHeld = startHeld;
  }

  _anyKey(set) {
    for (const code in this._keys) if (this._keys[code] && set.has(code)) return true;
    return false;
  }

  dispose() {
    this._target.removeEventListener('keydown', this._onKeyDown);
    this._target.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this._keys = null;
    this._pressed = null;
  }
}
