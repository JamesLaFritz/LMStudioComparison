/**
 * GamepadMapper — Maps abstract input actions to physical gamepad buttons/axes.
 * Provides deadzone handling, rumble feedback abstraction, and button state caching.
 */

const DEFAULT_GAMEPAD_MAP = {
  // D-pad / left stick horizontal
  moveLeft:  { axisX: -1, buttonA: 14, buttonB: 16 },
  moveRight: { axisX:  1, buttonA: 15, buttonB: 17 },
  // Left stick vertical (not typically used in Space Invaders but available)
  moveUp:    { axisY: -1 },
  moveDown:  { axisY:  1 },
  // Shoot / fire
  shoot:     { button: 0 },
  // Pause / menu
  pause:     { button: 7 },
};

const DEADZONE = 0.25;

export class GamepadMapper {
  constructor(gamepadIndex = 0) {
    this.gamepadIndex = gamepadIndex;
    this.map = DEFAULT_GAMEPAD_MAP;
    this._cachedAxes = new Float32Array(8);
    this._cachedButtons = new Uint8Array(16);
    this._gamepad = null;
    this.rumbleSupported = false;
  }

  poll() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    this._gamepad = gamepads[this.gamepadIndex] || null;

    if (!this._gamepad) return {};

    // Cache current state
    for (let i = 0; i < Math.min(this._gamepad.axes.length, 8); i++) {
      this._cachedAxes[i] = this._gamepad.axes[i];
    }
    for (let i = 0; i < Math.min(this._gamepad.buttons.length, 16); i++) {
      const btn = this._gamepad.buttons[i];
      this._cachedButtons[i] = btn.pressed ? 1 : 0;
    }

    // Check rumble support (once)
    if (!this.rumbleSupported && this._gamepad.hapticActuators) {
      this.rumbleSupported = true;
    }

    return this._evaluateActions();
  }

  _evaluateActions() {
    const result = {};
    const map = this.map;

    // moveLeft
    if (map.moveLeft) {
      let val = 0;
      if (map.moveLeft.axisX !== undefined) {
        const axisVal = this._cachedAxes[map.moveLeft.axisX] || 0;
        if (axisVal < -DEADZONE) val = Math.abs(axisVal);
      }
      if (!val && map.moveLeft.buttonA !== undefined) {
        val = this._cachedButtons[map.moveLeft.buttonA] ? 1 : 0;
      }
      if (!val && map.moveLeft.buttonB !== undefined) {
        val = this._cachedButtons[map.moveLeft.buttonB] ? 1 : 0;
      }
      result.moveLeft = val > 0;
    }

    // moveRight
    if (map.moveRight) {
      let val = 0;
      if (map.moveRight.axisX !== undefined) {
        const axisVal = this._cachedAxes[map.moveRight.axisX] || 0;
        if (axisVal > DEADZONE) val = Math.abs(axisVal);
      }
      if (!val && map.moveRight.buttonA !== undefined) {
        val = this._cachedButtons[map.moveRight.buttonA] ? 1 : 0;
      }
      if (!val && map.moveRight.buttonB !== undefined) {
        val = this._cachedButtons[map.moveRight.buttonB] ? 1 : 0;
      }
      result.moveRight = val > 0;
    }

    // shoot
    if (map.shoot && map.shoot.button !== undefined) {
      const btn = this._gamepad.buttons[map.shoot.button];
      result.shoot = btn ? btn.pressed : false;
    }

    // pause
    if (map.pause && map.pause.button !== undefined) {
      const btn = this._gamepad.buttons[map.pause.button];
      result.pause = btn ? btn.pressed : false;
    }

    return result;
  }

  rumble(durationMs = 100, weakMagnitude = 0.5, strongMagnitude = 1.0) {
    if (!this.rumbleSupported || !this._gamepad) return;
    const actuator = this._gamepad.hapticActuators[0];
    if (actuator) {
      actuator.pulse(strongMagnitude, durationMs);
    }
  }

  setMap(customMap) {
    this.map = { ...DEFAULT_GAMEPAD_MAP, ...customMap };
  }
}
