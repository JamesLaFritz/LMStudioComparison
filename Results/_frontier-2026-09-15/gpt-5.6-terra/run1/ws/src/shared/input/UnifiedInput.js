import { clamp } from '@shared/math/Math2D.js';

const PREVENT_DEFAULT = new Set([
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Enter',
  'Escape',
]);

const KEY_ACTIONS = {
  Space: ['fire', 'confirm'],
  Enter: ['confirm'],
  Escape: ['pause'],
  KeyP: ['pause'],
  KeyM: ['mute'],
};

export class UnifiedInput {
  constructor(target = window) {
    this.target = target;
    this.keys = new Set();
    this.actions = {
      move: 0,
      fire: false,
      confirm: false,
      pause: false,
      mute: false,
    };
    this.previous = { ...this.actions };
    this.justPressed = {
      fire: false,
      confirm: false,
      pause: false,
      mute: false,
    };
    this.gamepadConnected = false;
    this._onKeyDown = (event) => {
      if (PREVENT_DEFAULT.has(event.code)) {
        event.preventDefault();
      }
      const wasDown = this.keys.has(event.code);
      this.keys.add(event.code);
      if (!wasDown && KEY_ACTIONS[event.code]) {
        for (const action of KEY_ACTIONS[event.code]) {
          this.justPressed[action] = true;
        }
      }
    };
    this._onKeyUp = (event) => {
      this.keys.delete(event.code);
    };
    this._onGamepadConnected = () => {
      this.gamepadConnected = true;
    };
    this._onGamepadDisconnected = () => {
      this.gamepadConnected = this._readGamepad() !== null;
    };

    target.addEventListener('keydown', this._onKeyDown, { passive: false });
    target.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('gamepadconnected', this._onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
  }

  _readGamepad() {
    if (!navigator.getGamepads) {
      return null;
    }
    const pads = navigator.getGamepads();
    for (let index = 0; index < pads.length; index += 1) {
      if (pads[index]) {
        return pads[index];
      }
    }
    return null;
  }

  _axisWithDeadZone(value) {
    const deadZone = 0.22;
    const magnitude = Math.abs(value);
    if (magnitude <= deadZone) {
      return 0;
    }
    return Math.sign(value) * clamp((magnitude - deadZone) / (1 - deadZone), 0, 1);
  }

  update() {
    this.previous.move = this.actions.move;
    this.previous.fire = this.actions.fire;
    this.previous.confirm = this.actions.confirm;
    this.previous.pause = this.actions.pause;
    this.previous.mute = this.actions.mute;

    const keyboardMove = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
      - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const pad = this._readGamepad();
    let gamepadMove = 0;
    let gamepadFire = false;
    let gamepadConfirm = false;
    let gamepadPause = false;
    let gamepadMute = false;

    if (pad) {
      this.gamepadConnected = true;
      const stick = this._axisWithDeadZone(pad.axes[0] || 0);
      const dpad = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
      gamepadMove = Math.abs(stick) >= Math.abs(dpad) ? stick : dpad;
      gamepadFire = Boolean(pad.buttons[0]?.pressed);
      gamepadConfirm = Boolean(pad.buttons[0]?.pressed);
      gamepadPause = Boolean(pad.buttons[9]?.pressed);
      gamepadMute = Boolean(pad.buttons[3]?.pressed);
    }

    this.actions.move = Math.abs(gamepadMove) > Math.abs(keyboardMove) ? gamepadMove : keyboardMove;
    this.actions.fire = this.keys.has('Space') || gamepadFire;
    this.actions.confirm = this.keys.has('Enter') || this.keys.has('Space') || gamepadConfirm;
    this.actions.pause = this.keys.has('Escape') || this.keys.has('KeyP') || gamepadPause;
    this.actions.mute = this.keys.has('KeyM') || gamepadMute;

    this.justPressed.fire = this.justPressed.fire || (this.actions.fire && !this.previous.fire);
    this.justPressed.confirm = this.justPressed.confirm || (this.actions.confirm && !this.previous.confirm);
    this.justPressed.pause = this.justPressed.pause || (this.actions.pause && !this.previous.pause);
    this.justPressed.mute = this.justPressed.mute || (this.actions.mute && !this.previous.mute);
  }

  pressed(action) {
    return Boolean(this.justPressed[action]);
  }

  consume(action) {
    const pressed = Boolean(this.justPressed[action]);
    this.justPressed[action] = false;
    return pressed;
  }

  value(action) {
    return this.actions[action] ?? 0;
  }

  dispose() {
    this.target.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('gamepadconnected', this._onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);
    this.keys.clear();
  }
}
