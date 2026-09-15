/**
 * Input — unified dual-input controller (keyboard + Gamepad API).
 *
 * Both devices map onto the same action names:
 *   left / right / fire / pause / start
 *
 * Keyboard:  A / ArrowLeft → left,  D / ArrowRight → right,
 *            Space / J / Z → fire,  P / Escape → pause,  Enter → start
 * Gamepad:   left stick X or D-pad,  A / RT (0/7) → fire,
 *            Start (9) → start,  Pause (6) → pause
 *
 * `update()` is called once per frame: it polls the gamepad, refreshes the
 * held-state, and computes edge-triggered presses. `pressed(name)` returns
 * true exactly once per logical press (consumed on read).
 *
 * A disconnected gamepad simply contributes no input — the controller
 * degrades silently to keyboard.
 */
const KEY_MAP = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'fire',
  KeyJ: 'fire',
  KeyZ: 'fire',
  KeyP: 'pause',
  Escape: 'pause',
  Enter: 'start',
};

const GAMEPAD_BUTTONS = {
  0: 'fire',   // A / Cross
  2: 'fire',   // X (alternate)
  7: 'fire',   // RT
  6: 'pause',  // Start-adjacent / B
  9: 'start',  // Start
};

export class Input {
  constructor() {
    this._held = new Set();       // currently held action names
    this._pressed = new Set();    // edge-triggered, consumed by pressed()
    this._prevButtons = new Map(); // gamepad button index → wasDown
    this._padIndex = -1;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  _onKeyDown(e) {
    const action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (!this._held.has(action)) this._pressed.add(action);
    this._held.add(action);
  }

  _onKeyUp(e) {
    const action = KEY_MAP[e.code];
    if (!action) return;
    this._held.delete(action);
  }

  _onBlur() {
    // Release everything on focus loss so nothing sticks.
    this._held.clear();
    this._pressed.clear();
    this._prevButtons.clear();
  }

  /** Call once per frame, before reading any action. */
  update() {
    // ── Gamepad ──────────────────────────────────────────────────────────
    // Keyboard edges are added by _onKeyDown (between frames) and must
    // survive until the game reads them via pressed(). So we do NOT clear
    // _pressed here. Instead we compute the current held set and add edges
    // for actions that are newly held (not held last frame). Stale edges
    // (action no longer held) are dropped.
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) {
      if (p && p.connected) { pad = p; break; }
    }
    this._padIndex = pad ? pad.index : -1;

    const heldNow = new Set();
    if (pad) {
      // Axes: left stick X (deadzone 0.25) + D-pad (buttons 14/15).
      const ax = pad.axes[0] || 0;
      if (ax < -0.25) heldNow.add('left');
      if (ax > 0.25) heldNow.add('right');
      if (pad.buttons[14] && pad.buttons[14].pressed) heldNow.add('left');
      if (pad.buttons[15] && pad.buttons[15].pressed) heldNow.add('right');

      // Buttons.
      for (const [idxStr, action] of Object.entries(GAMEPAD_BUTTONS)) {
        const b = pad.buttons[Number(idxStr)];
        if (b && b.pressed) heldNow.add(action);
      }
    }

    // Keyboard-held actions persist (they live in this._held from key events).
    for (const a of this._held) heldNow.add(a);

    // Drop edges for actions that are no longer held (released this frame).
    if (this._current) {
      for (const a of this._current) {
        if (!heldNow.has(a) && this._pressed.has(a)) this._pressed.delete(a);
      }
    }

    // Edge detection: newly-held actions become "pressed".
    for (const a of heldNow) {
      if (!this._current || !this._current.has(a)) this._pressed.add(a);
    }
    this._current = heldNow;
  }

  /** Continuous axis in [-1, 1] from keyboard + gamepad. */
  axisX() {
    let x = 0;
    if (this._held.has('left')) x -= 1;
    if (this._held.has('right')) x += 1;
    if (this._padIndex >= 0 && navigator.getGamepads) {
      const pad = navigator.getGamepads()[this._padIndex];
      if (pad) {
        const ax = pad.axes[0] || 0;
        if (Math.abs(ax) > 0.25) x = ax; // stick overrides digital
      }
    }
    return Math.max(-1, Math.min(1, x));
  }

  /** True while the action is held (keyboard or gamepad). */
  held(name) {
    return (this._current && this._current.has(name)) || this._held.has(name);
  }

  /**
   * Edge-triggered: true on the first frame after a press, false until
   * released and pressed again. Consumed on read.
   */
  pressed(name) {
    if (this._pressed.has(name)) {
      this._pressed.delete(name);
      return true;
    }
    return false;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this._held.clear();
    this._pressed.clear();
  }
}
