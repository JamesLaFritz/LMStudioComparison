const DEFAULT_KEY_BINDINGS = {
  moveLeft: ['ArrowLeft', 'KeyA'],
  moveRight: ['ArrowRight', 'KeyD'],
  moveUp: ['ArrowUp', 'KeyW'],
  moveDown: ['ArrowDown', 'KeyS'],
  fire: ['Space', 'KeyJ'],
  pause: ['Escape', 'KeyP']
};

const GAMEPAD_BUTTON = {
  fire: 0,
  pause: 9
};

const STICK_DEADZONE = 0.18;

/**
 * Unified keyboard + Gamepad API input. Press/release edges are captured by
 * the keydown/keyup listeners themselves into pending sets — never derived
 * by diffing a polled snapshot — so a press-and-release that both happen
 * inside a single polling interval (a fast tap, or a scripted test) is never
 * silently dropped. poll() only drains those pending sets and recomputes the
 * continuous axis/held state once per game tick.
 */
export class InputManager {
  constructor(keyBindings = DEFAULT_KEY_BINDINGS) {
    this._keyBindings = keyBindings;
    this._codeToActions = new Map();
    for (const action in keyBindings) {
      for (const code of keyBindings[action]) {
        if (!this._codeToActions.has(code)) this._codeToActions.set(code, []);
        this._codeToActions.get(code).push(action);
      }
    }

    this._keysDown = new Set();
    this._gamepadIndex = null;
    this._gamepadPrevHeld = new Set();

    this._axisX = 0;
    this._axisY = 0;

    this._actionsHeld = new Set();
    this._pendingPressed = new Set();
    this._pendingReleased = new Set();
    this._actionsPressedThisFrame = new Set();
    this._actionsReleasedThisFrame = new Set();

    this._onKeyDown = (e) => {
      if (this._keysDown.has(e.code)) return;
      this._keysDown.add(e.code);
      const actions = this._codeToActions.get(e.code);
      if (!actions) return;
      for (const action of actions) {
        if (!this._actionsHeld.has(action)) this._pendingPressed.add(action);
        this._actionsHeld.add(action);
      }
    };

    this._onKeyUp = (e) => {
      this._keysDown.delete(e.code);
      const actions = this._codeToActions.get(e.code);
      if (!actions) return;
      for (const action of actions) {
        const stillHeldByOtherKey = this._keyBindings[action].some((code) => this._keysDown.has(code));
        if (!stillHeldByOtherKey) {
          this._actionsHeld.delete(action);
          this._pendingReleased.add(action);
        }
      }
    };

    this._onGamepadConnected = (e) => {
      if (this._gamepadIndex === null) this._gamepadIndex = e.gamepad.index;
    };
    this._onGamepadDisconnected = (e) => {
      if (this._gamepadIndex === e.gamepad.index) this._gamepadIndex = null;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('gamepadconnected', this._onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
  }

  _readGamepad() {
    if (this._gamepadIndex === null) return null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return pads[this._gamepadIndex] || null;
  }

  poll() {
    this._axisX = 0;
    this._axisY = 0;

    if (this._actionsHeld.has('moveLeft')) this._axisX -= 1;
    if (this._actionsHeld.has('moveRight')) this._axisX += 1;
    if (this._actionsHeld.has('moveUp')) this._axisY += 1;
    if (this._actionsHeld.has('moveDown')) this._axisY -= 1;

    const gamepad = this._readGamepad();
    if (gamepad) {
      const stickX = gamepad.axes[0] || 0;
      const stickY = gamepad.axes[1] || 0;
      if (Math.abs(stickX) > STICK_DEADZONE) this._axisX = clampAxis(this._axisX + stickX);
      if (Math.abs(stickY) > STICK_DEADZONE) this._axisY = clampAxis(this._axisY - stickY);

      const gamepadHeldNow = new Set();
      if (gamepad.buttons[GAMEPAD_BUTTON.fire]?.pressed) gamepadHeldNow.add('fire');
      if (gamepad.buttons[GAMEPAD_BUTTON.pause]?.pressed) gamepadHeldNow.add('pause');

      for (const action of gamepadHeldNow) {
        if (!this._actionsHeld.has(action)) this._pendingPressed.add(action);
        this._actionsHeld.add(action);
      }
      for (const action of this._gamepadPrevHeld) {
        if (gamepadHeldNow.has(action)) continue;
        const stillHeldByKeyboard = (this._keyBindings[action] || []).some((code) => this._keysDown.has(code));
        if (!stillHeldByKeyboard) {
          this._actionsHeld.delete(action);
          this._pendingReleased.add(action);
        }
      }
      this._gamepadPrevHeld = gamepadHeldNow;
    }

    this._axisX = clampAxis(this._axisX);
    this._axisY = clampAxis(this._axisY);

    this._actionsPressedThisFrame = this._pendingPressed;
    this._actionsReleasedThisFrame = this._pendingReleased;
    this._pendingPressed = new Set();
    this._pendingReleased = new Set();
  }

  isHeld(action) {
    return this._actionsHeld.has(action);
  }

  wasPressed(action) {
    return this._actionsPressedThisFrame.has(action);
  }

  wasReleased(action) {
    return this._actionsReleasedThisFrame.has(action);
  }

  get axisX() {
    return this._axisX;
  }

  get axisY() {
    return this._axisY;
  }

  rumble(strength = 0.6, durationMs = 120) {
    const gamepad = this._readGamepad();
    const actuator = gamepad?.vibrationActuator;
    if (!actuator || typeof actuator.playEffect !== 'function') return;
    actuator.playEffect('dual-rumble', {
      duration: durationMs,
      strongMagnitude: strength,
      weakMagnitude: strength * 0.7
    }).catch(() => {});
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('gamepadconnected', this._onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);
  }
}

function clampAxis(v) {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
