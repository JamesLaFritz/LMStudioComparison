// Unified Keyboard + Gamepad Input Manager
export class InputManager {
  constructor() {
    this.keys = {};
    this.prevKeys = {};
    this.gamepads = [null, null];
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onGamepadConnected = this._onGamepadConnected.bind(this);
    this._onGamepadDisconnected = this._onGamepadDisconnected.bind(this);
  }

  init() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('gamepadconnected', this._onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
  }

  shutdown() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('gamepadconnected', this._onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
  }

  _onGamepadConnected(e) {
    this.gamepads[e.gamepad.index] = e.gamepad;
  }

  _onGamepadDisconnected(e) {
    this.gamepads[e.gamepad.index] = null;
  }

  poll() {
    // Snapshot previous frame keys
    this.prevKeys = { ...this.keys };
    // Refresh gamepad state
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]) this.gamepads[i] = pads[i];
    }
  }

  isDown(code) {
    return !!this.keys[code];
  }

  justPressed(code) {
    return !!this.keys[code] && !this.prevKeys[code];
  }

  // Gamepad analog stick with deadzone
  getStick(playerIndex, stick) {
    const gp = this.gamepads[playerIndex];
    if (!gp) return { x: 0, y: 0 };
    const axisIndex = stick === 'left' ? [0, 1] : [2, 3];
    let x = gp.axes[axisIndex[0]] || 0;
    let y = gp.axes[axisIndex[1]] || 0;
    const deadzone = 0.12;
    if (Math.abs(x) < deadzone) x = 0;
    else x = Math.sign(x) * (Math.abs(x) - deadzone) / (1 - deadzone);
    if (Math.abs(y) < deadzone) y = 0;
    else y = Math.sign(y) * (Math.abs(y) - deadzone) / (1 - deadzone);
    return { x, y };
  }

  getGamepadButton(playerIndex, button) {
    const gp = this.gamepads[playerIndex];
    if (!gp) return false;
    return !!gp.buttons[button] && gp.buttons[button].value > 0.5;
  }
}
