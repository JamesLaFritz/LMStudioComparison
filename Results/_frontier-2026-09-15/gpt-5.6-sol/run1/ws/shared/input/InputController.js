const ACTION_NAMES = ['fire', 'confirm', 'pause', 'restart', 'mute'];

export const DEFAULT_BINDINGS = Object.freeze({
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  fire: ['Space'],
  confirm: ['Enter', 'Space'],
  pause: ['Escape', 'KeyP'],
  restart: ['KeyR'],
  mute: ['KeyM'],
});

const isAnyDown = (keys, codes) => codes.some((code) => keys.has(code));

export class InputController {
  constructor({ bindings = DEFAULT_BINDINGS, deadZone = 0.2, onGamepadChange = () => {} } = {}) {
    this.bindings = bindings;
    this.deadZone = deadZone;
    this.onGamepadChange = onGamepadChange;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.abortController = new AbortController();
    this.previous = Object.fromEntries(ACTION_NAMES.map((name) => [name, false]));
    this.current = Object.fromEntries(ACTION_NAMES.map((name) => [name, false]));
    this.snapshot = {
      axisX: 0,
      fire: false,
      confirm: false,
      pause: false,
      restart: false,
      mute: false,
      firePressed: false,
      confirmPressed: false,
      pausePressed: false,
      restartPressed: false,
      mutePressed: false,
      usingGamepad: false,
    };
    this.activeGamepadIndex = -1;
    this.injected = null;
    this.injectedFrames = 0;
    this._installListeners();
  }

  _installListeners() {
    const options = { signal: this.abortController.signal };
    window.addEventListener('keydown', (event) => {
      if (this._isBoundCode(event.code)) event.preventDefault();
      if (!event.repeat && !this.keys.has(event.code)) this.pressedKeys.add(event.code);
      this.keys.add(event.code);
    }, options);
    window.addEventListener('keyup', (event) => {
      if (this._isBoundCode(event.code)) event.preventDefault();
      this.keys.delete(event.code);
    }, options);
    window.addEventListener('blur', () => this.clear(), options);
    window.addEventListener('gamepadconnected', (event) => {
      this.activeGamepadIndex = event.gamepad.index;
      this.onGamepadChange(true, event.gamepad.id);
    }, options);
    window.addEventListener('gamepaddisconnected', (event) => {
      if (event.gamepad.index === this.activeGamepadIndex) this.activeGamepadIndex = -1;
      this.onGamepadChange(false, event.gamepad.id);
    }, options);
  }

  _isBoundCode(code) {
    return Object.values(this.bindings).some((codes) => codes.includes(code));
  }

  _applyDeadZone(value) {
    const magnitude = Math.abs(value);
    if (magnitude <= this.deadZone) return 0;
    return Math.sign(value) * ((magnitude - this.deadZone) / (1 - this.deadZone));
  }

  _getGamepad() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
    const pads = navigator.getGamepads();
    if (this.activeGamepadIndex >= 0 && pads[this.activeGamepadIndex]) return pads[this.activeGamepadIndex];
    for (const pad of pads) {
      if (pad?.connected) {
        this.activeGamepadIndex = pad.index;
        return pad;
      }
    }
    return null;
  }

  update() {
    const keyboardAxis = (isAnyDown(this.keys, this.bindings.right) ? 1 : 0)
      - (isAnyDown(this.keys, this.bindings.left) ? 1 : 0);
    const pad = this._getGamepad();
    let gamepadAxis = 0;
    let padFire = false;
    let padPause = false;
    let padRestart = false;
    let padMute = false;

    if (pad) {
      const stick = this._applyDeadZone(pad.axes[0] ?? 0);
      const dpad = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
      gamepadAxis = Math.abs(dpad) > Math.abs(stick) ? dpad : stick;
      padFire = Boolean(pad.buttons[0]?.pressed);
      padPause = Boolean(pad.buttons[9]?.pressed);
      padRestart = Boolean(pad.buttons[2]?.pressed || pad.buttons[3]?.pressed);
      padMute = Boolean(pad.buttons[8]?.pressed);
    }

    let axisX = Math.abs(gamepadAxis) > Math.abs(keyboardAxis) ? gamepadAxis : keyboardAxis;
    this.current.fire = isAnyDown(this.keys, this.bindings.fire) || padFire;
    this.current.confirm = isAnyDown(this.keys, this.bindings.confirm) || padFire;
    this.current.pause = isAnyDown(this.keys, this.bindings.pause) || padPause;
    this.current.restart = isAnyDown(this.keys, this.bindings.restart) || padRestart;
    this.current.mute = isAnyDown(this.keys, this.bindings.mute) || padMute;
    if (this.injectedFrames > 0 && this.injected) {
      axisX = this.injected.axisX ?? axisX;
      for (const action of ACTION_NAMES) this.current[action] ||= Boolean(this.injected[action]);
      this.injectedFrames -= 1;
      if (this.injectedFrames === 0) this.injected = null;
    }

    this.snapshot.axisX = axisX;
    this.snapshot.usingGamepad = Boolean(pad);
    for (const action of ACTION_NAMES) {
      const keyboardPressed = isAnyDown(this.pressedKeys, this.bindings[action]);
      this.snapshot[action] = this.current[action] || keyboardPressed;
      this.snapshot[`${action}Pressed`] = keyboardPressed || (this.current[action] && !this.previous[action]);
      this.previous[action] = this.current[action];
    }
    this.pressedKeys.clear();
    return this.snapshot;
  }

  clear() {
    this.keys.clear();
    this.pressedKeys.clear();
    for (const action of ACTION_NAMES) {
      this.previous[action] = false;
      this.current[action] = false;
      this.snapshot[action] = false;
      this.snapshot[`${action}Pressed`] = false;
    }
    this.snapshot.axisX = 0;
    this.injected = null;
    this.injectedFrames = 0;
  }

  injectSnapshot(snapshot, frames = 1) {
    this.injected = { ...snapshot };
    this.injectedFrames = Math.max(1, Math.floor(frames));
  }

  dispose() {
    this.abortController.abort();
    this.clear();
    this.onGamepadChange = () => {};
  }
}
