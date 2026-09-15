// Unified dual-input controller: Keyboard (WASD / arrows) + Gamepad API.
// Exposes one normalized query API regardless of source. No per-frame
// allocation: key state is a fixed Set, gamepad samples are cached in
// module-level scratch objects.

const AXIS_KEYS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
};

const ACTION_KEYS = {
  fire: ['Space', 'KeyJ'],
  pause: ['KeyP', 'Escape'],
  start: ['Enter', 'Space'],
};

const DEADZONE = 0.22;

function deadzone(v) {
  if (Math.abs(v) < DEADZONE) return 0;
  return (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
}

export default class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, drained each frame
    this.released = new Set();
    this._padPressed = new Set(); // gamepad buttons pressed since last sample
    this.gamepadIndex = null;
    this.gamepadConnected = false;
    this._padButtons = [];
    this._padAxes = [0, 0, 0, 0];
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundKeyUp = this._onKeyUp.bind(this);
    this._boundBlur = this._onBlur.bind(this);
    this._boundPad = this._onPad.bind(this);
    window.addEventListener('keydown', this._boundKeyDown, { passive: true });
    window.addEventListener('keyup', this._boundKeyUp, { passive: true });
    window.addEventListener('blur', this._boundBlur);
    window.addEventListener('gamepadconnected', this._boundPad);
    window.addEventListener('gamepaddisconnected', this._boundPad);
  }

  _onKeyDown(e) {
    if (e.repeat) return;
    this.keys.add(e.code);
    this.pressed.add(e.code);
    // Keep the page from scrolling on game keys.
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
    this.released.add(e.code);
  }

  _onBlur() {
    this.keys.clear();
    this.pressed.clear();
    this.released.clear();
  }

  _onPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected) {
        this.gamepadIndex = p.index;
        this.gamepadConnected = true;
        return;
      }
    }
    this.gamepadIndex = null;
    this.gamepadConnected = false;
  }

  /**
   * Sample gamepad state once per frame (call before reading axes/buttons).
   * Gamepad API state is only valid during the rAF callback window.
   */
  sample() {
    if (this.gamepadIndex === null) {
      this._padButtons.length = 0;
      return;
    }
    const pad = navigator.getGamepads ? navigator.getGamepads()[this.gamepadIndex] : null;
    if (!pad || !pad.connected) {
      this._padButtons.length = 0;
      return;
    }
    const prev = this._padButtons;
    this._padButtons.length = pad.buttons.length;
    for (let i = 0; i < pad.buttons.length; i++) {
      const now = pad.buttons[i].pressed;
      this._padButtons[i] = now;
      if (now && !prev[i]) this._padPressed.add(i);
    }
    for (let i = 0; i < 4 && i < pad.axes.length; i++) this._padAxes[i] = pad.axes[i];
  }

  /** Continuous axis in [-1, 1]. Keyboard + gamepad, gamepad wins if non-zero. */
  axis(h) {
    let v = 0;
    if (h === 'x') {
      if (this.keys.has(AXIS_KEYS.right[0]) || this.keys.has(AXIS_KEYS.right[1])) v += 1;
      if (this.keys.has(AXIS_KEYS.left[0]) || this.keys.has(AXIS_KEYS.left[1])) v -= 1;
      v += deadzone(this._padAxes[0] || 0);
    } else if (h === 'y') {
      if (this.keys.has(AXIS_KEYS.up[0]) || this.keys.has(AXIS_KEYS.up[1])) v += 1;
      if (this.keys.has(AXIS_KEYS.down[0]) || this.keys.has(AXIS_KEYS.down[1])) v -= 1;
      v -= deadzone(this._padAxes[1] || 0); // screen-up is +y in our world
    }
    return Math.max(-1, Math.min(1, v));
  }

  /** Held state (keyboard key or gamepad button index). */
  down(action) {
    for (const code of ACTION_KEYS[action]) if (this.keys.has(code)) return true;
    const btn = PAD_BUTTONS[action];
    if (btn !== undefined && this._padButtons[btn]) return true;
    return false;
  }

  /** Edge-triggered press; drains the event so it fires exactly once. */
  pressedAction(action) {
    for (const code of ACTION_KEYS[action]) {
      if (this.pressed.has(code)) {
        this.pressed.delete(code);
        return true;
      }
    }
    for (const btn of PAD_BUTTONS[action]) {
      if (this._padPressed.has(btn)) {
        this._padPressed.delete(btn);
        return true;
      }
    }
    return false;
  }

  /** True if any input source is currently active (for "press any key" prompts). */
  anyPressed() {
    return this.pressed.size > 0 || this._padPressed.size > 0 || this._padButtons.some(Boolean);
  }

  /** Call at end of frame: clears edge-triggered state. */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this._padPressed.clear();
  }

  dispose() {
    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup', this._boundKeyUp);
    window.removeEventListener('blur', this._boundBlur);
    window.removeEventListener('gamepadconnected', this._boundPad);
    window.removeEventListener('gamepaddisconnected', this._boundPad);
  }
}

// Standard mapping: 0=A/Cross, 1=B/Circle, 2=X/Square, 3=Y/Triangle,
// 4=LB, 5=RB, 7=RT, 9=Start, 12=DpadUp.
const PAD_BUTTONS = {
  fire: [0, 2, 7],
  pause: [9],
  start: [9, 0],
};
