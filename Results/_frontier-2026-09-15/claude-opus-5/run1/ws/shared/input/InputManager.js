// Unified dual-input controller. Keyboard (WASD / arrows) and Gamepad API are folded into named
// actions with per-frame edge detection. `takePress` is a latched edge for fixed-step consumers so
// a tap is never lost on a frame in which zero simulation steps run.
import { KeyboardSource } from './KeyboardSource.js';
import { GamepadSource } from './GamepadSource.js';

export const Actions = Object.freeze({
  LEFT: 'left',
  RIGHT: 'right',
  UP: 'up',
  DOWN: 'down',
  FIRE: 'fire',
  ALT_FIRE: 'altFire',
  CONFIRM: 'confirm',
  BACK: 'back',
  PAUSE: 'pause',
});

const ACTION_LIST = Object.values(Actions);

const DEFAULT_KEYS = {
  [Actions.LEFT]: ['ArrowLeft', 'KeyA'],
  [Actions.RIGHT]: ['ArrowRight', 'KeyD'],
  [Actions.UP]: ['ArrowUp', 'KeyW'],
  [Actions.DOWN]: ['ArrowDown', 'KeyS'],
  [Actions.FIRE]: ['Space', 'KeyJ', 'KeyZ', 'ControlLeft', 'ControlRight'],
  [Actions.ALT_FIRE]: ['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyX'],
  [Actions.CONFIRM]: ['Enter', 'Space', 'NumpadEnter'],
  [Actions.BACK]: ['Escape', 'Backspace'],
  [Actions.PAUSE]: ['Escape', 'KeyP'],
};

const DEFAULT_BUTTONS = {
  [Actions.LEFT]: [14],
  [Actions.RIGHT]: [15],
  [Actions.UP]: [12],
  [Actions.DOWN]: [13],
  [Actions.FIRE]: [0, 2, 7, 5],
  [Actions.ALT_FIRE]: [1, 3, 6, 4],
  [Actions.CONFIRM]: [0, 9],
  [Actions.BACK]: [1],
  [Actions.PAUSE]: [9],
};

// Stick directions also drive the digital directional actions (for menus and 4-way games).
const STICK_THRESHOLD = 0.5;

export class InputManager {
  constructor({ target = window, deadzone = 0.2, keys = DEFAULT_KEYS, buttons = DEFAULT_BUTTONS } = {}) {
    this.keyboard = new KeyboardSource(target);
    this.gamepad = new GamepadSource({ deadzone });
    this.keys = keys;
    this.buttons = buttons;
    this.activeDevice = 'keyboard';
    this._state = {};
    for (const a of ACTION_LIST) {
      this._state[a] = { held: false, pressed: false, released: false, latched: false, presses: 0 };
    }
    this._anyPressed = false;
  }

  /** Poll devices and compute edges. Call exactly once per rendered frame, before any queries. */
  update() {
    this.gamepad.poll();
    this._anyPressed = false;
    const gp = this.gamepad;
    const kb = this.keyboard;

    if (gp.connected && gp.lastActivity > kb.lastActivity) this.activeDevice = 'gamepad';
    else if (kb.lastActivity > 0) this.activeDevice = 'keyboard';

    const sx = gp.axis(0);
    const sy = gp.axis(1);

    for (let i = 0; i < ACTION_LIST.length; i++) {
      const action = ACTION_LIST[i];
      const s = this._state[action];
      let now = kb.anyDown(this.keys[action]);
      if (!now && gp.connected) {
        const list = this.buttons[action];
        for (let b = 0; b < list.length; b++) {
          if (gp.isDown(list[b])) {
            now = true;
            break;
          }
        }
        if (!now) {
          if (action === Actions.LEFT && sx < -STICK_THRESHOLD) now = true;
          else if (action === Actions.RIGHT && sx > STICK_THRESHOLD) now = true;
          else if (action === Actions.UP && sy < -STICK_THRESHOLD) now = true;
          else if (action === Actions.DOWN && sy > STICK_THRESHOLD) now = true;
        }
      }
      // A new keydown counts as a press even if the previous press was never seen released
      // (two taps inside one frame), so no tap can ever merge into a hold.
      const presses = kb.pressCount(this.keys[action]);
      s.pressed = (now && !s.held) || presses > s.presses;
      s.presses = presses;
      s.released = !now && s.held;
      s.held = now;
      if (s.pressed) {
        s.latched = true;
        this._anyPressed = true;
      }
    }
    kb.endFrame();
  }

  held(action) {
    return this._state[action].held;
  }

  /** True only on the frame the action went down. */
  pressed(action) {
    return this._state[action].pressed;
  }

  released(action) {
    return this._state[action].released;
  }

  /** Latched edge: true once per press, regardless of how many frames passed since the press. */
  takePress(action) {
    const s = this._state[action];
    if (s.latched) {
      s.latched = false;
      return true;
    }
    return false;
  }

  /** Discard latched presses (call on state transitions so a menu confirm doesn't fire a shot). */
  flush() {
    for (let i = 0; i < ACTION_LIST.length; i++) this._state[ACTION_LIST[i]].latched = false;
  }

  /** Any action pressed this frame (used for "press any key" and audio unlock). */
  anyPressed() {
    return this._anyPressed;
  }

  /**
   * Analog axis in [-1, 1]. 'moveX' / 'moveY' combine digital keys with the left stick;
   * whichever has the larger magnitude wins. +Y is up.
   */
  axis(name) {
    const gp = this.gamepad;
    if (name === 'moveX') {
      const kb = (this.held(Actions.RIGHT) ? 1 : 0) - (this.held(Actions.LEFT) ? 1 : 0);
      const stick = gp.connected ? gp.axis(0) : 0;
      return Math.abs(stick) > Math.abs(kb) ? stick : kb;
    }
    if (name === 'moveY') {
      const kb = (this.held(Actions.UP) ? 1 : 0) - (this.held(Actions.DOWN) ? 1 : 0);
      const stick = gp.connected ? -gp.axis(1) : 0;
      return Math.abs(stick) > Math.abs(kb) ? stick : kb;
    }
    if (name === 'lookX') return gp.connected ? gp.axis(2) : 0;
    if (name === 'lookY') return gp.connected ? -gp.axis(3) : 0;
    return 0;
  }

  rumble(duration, weak, strong) {
    this.gamepad.rumble(duration, weak, strong);
  }

  dispose() {
    this.keyboard.dispose();
    this.gamepad.dispose();
  }
}
