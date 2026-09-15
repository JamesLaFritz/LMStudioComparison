// input.js — Unified keyboard + Gamepad API abstraction

/**
 * InputState tracks all active inputs.
 */
export class InputState {
  constructor() {
    this.keys = {};
    this.gamepad = null;
    this.gamepadAxes = [];
    this.gamepadButtons = new Set();
    this._gamepadListeners = [];
    this._keyboardListeners = [];

    // Keyboard state: key name -> boolean (true if pressed)
    this.keyMap = {
      'ArrowLeft': false,
      'ArrowRight': false,
      'ArrowUp': false,
      'ArrowDown': false,
      'KeyA': false,
      'KeyD': false,
      'Space': false,
      'KeyW': false,
      'KeyS': false,
    };

    // Gamepad button mapping (standard layout)
    this.gamepadButtonMap = {
      LEFT: 0,
      RIGHT: 1,
      UP: 2,
      DOWN: 3,
      START: 4,
      SELECT: 5,
      TRIGGER_LEFT: 6,
      TRIGGER_RIGHT: 7,
    };

    this._initListeners();
  }

  /**
   * Initialize keyboard and gamepad listeners.
   */
  _initListeners() {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
      if (!this._keyboardListeners.includes(e)) {
        this._keyboardListeners.push(e);
      }
      const key = e.key;
      if (key in this.keyMap) {
        this.keyMap[key] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this._keyboardListeners.includes(e)) {
        this._keyboardListeners.push(e);
      }
      const key = e.key;
      if (key in this.keyMap) {
        this.keyMap[key] = false;
      }
    });

    // Gamepad events
    window.addEventListener('gamepadconnected', (e) => {
      this._handleGamepadConnected(e);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      this._handleGamepadDisconnected(e);
    });

    // Polling for gamepad state changes (some browsers don't fire events consistently)
    setInterval(() => {
      this._pollGamepadState();
    }, 16); // ~60Hz polling
  }

  /**
   * Handle a new gamepad connection.
   */
  _handleGamepadConnected(e) {
    const gamepad = e.gamepad;
    if (!this.gamepad || this.gamepad.id !== gamepad.id) {
      this.gamepad = gamepad;
      this._setupGamepadListeners(gamepad);
    }
  }

  /**
   * Handle a gamepad disconnection.
   */
  _handleGamepadDisconnected(e) {
    if (this.gamepad && this.gamepad.id === e.gamepad.id) {
      this.gamepad = null;
      this._removeGamepadListeners();
    }
  }

  /**
   * Set up event listeners for a specific gamepad.
   */
  _setupGamepadListeners(gamepad) {
    // Remove existing listeners first
    this._removeGamepadListeners();

    const onInput = (e) => {
      if (!this.gamepad || this.gamepad.id !== e.gamepad.id) return;

      // Update axes
      for (let i = 0; i < Math.min(e.gamepad.axisCount, 4); i++) {
        if (i < this.gamepadAxes.length) {
          this.gamepadAxes[i] = e.gamepad.axes[i];
        } else {
          this.gamepadAxes.push(0);
        }
      }

      // Update buttons
      for (let i = 0; i < Math.min(e.gamepad.buttonCount, 12); i++) {
        if (i < this.gamepadButtons.size) {
          const btn = e.gamepad.buttons[i];
          if (btn) {
            this.gamepadButtons.add(i);
          } else {
            this.gamepadButtons.delete(i);
          }
        }
      }

      // Update button state for known buttons
      for (const [name, index] of Object.entries(this.gamepadButtonMap)) {
        if (index < e.gamepad.buttonCount) {
          const btn = e.gamepad.buttons[index];
          this._gamepadButtons[name] = !!btn;
        }
      }
    };

    gamepad.addEventListener('input', onInput);
    this._gamepadListeners.push(onInput);
  }

  /**
   * Remove all gamepad event listeners.
   */
  _removeGamepadListeners() {
    for (const listener of this._gamepadListeners) {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    }
    this._gamepadListeners = [];
  }

  /**
   * Poll gamepad state from all connected gamepads.
   */
  _pollGamepadState() {
    const gamepads = window.gamepads || [];
    for (const gp of gamepads) {
      if (!this.gamepad || this.gamepad.id !== gp.id) {
        this.gamepad = gp;
        this._setupGamepadListeners(gp);
      }

      // Update axes
      for (let i = 0; i < Math.min(gp.axisCount, 4); i++) {
        if (i < this.gamepadAxes.length) {
          this.gamepadAxes[i] = gp.axes[i];
        } else {
          this.gamepadAxes.push(0);
        }
      }

      // Update buttons
      for (let i = 0; i < Math.min(gp.buttonCount, 12); i++) {
        if (i < this.gamepadButtons.size) {
          const btn = gp.buttons[i];
          if (btn) {
            this.gamepadButtons.add(i);
          } else {
            this.gamepadButtons.delete(i);
          }
        }
      }

      // Update button state for known buttons
      for (const [name, index] of Object.entries(this.gamepadButtonMap)) {
        if (index < gp.buttonCount) {
          const btn = gp.buttons[index];
          this._gamepadButtons[name] = !!btn;
        }
      }
    }

    // If no gamepads connected and we had one, disconnect it
    if (!gamepads.length && this.gamepad) {
      this.gamepad = null;
      this._removeGamepadListeners();
    }
  }

  /**
   * Check if a keyboard key is currently pressed.
   * @param {string} key - Key name (e.g., 'ArrowLeft', 'Space')
   * @returns {boolean}
   */
  isKeyPressed(key) {
    return !!this.keyMap[key];
  }

  /**
   * Check if any keyboard key in the list is pressed.
   * @param {...string} keys
   * @returns {boolean}
   */
  isAnyKeyPressed(...keys) {
    for (const key of keys) {
      if (this.isKeyPressed(key)) return true;
    }
    return false;
  }

  /**
   * Check if any keyboard key in the list is NOT pressed.
   * @param {...string} keys
   * @returns {boolean}
   */
  isAnyKeyNotPressed(...keys) {
    for (const key of keys) {
      if (!this.isKeyPressed(key)) return true;
    }
    return false;
  }

  /**
   * Get the horizontal input direction (-1, 0, or 1).
   * Supports both keyboard and gamepad.
   * @returns {number} -1 (left), 0 (none), 1 (right)
   */
  getHorizontalInput() {
    let dir = 0;

    // Keyboard input
    if (this.isKeyPressed('ArrowLeft') || this.isKeyPressed('KeyA')) {
      dir -= 1;
    }
    if (this.isKeyPressed('ArrowRight') || this.isKeyPressed('KeyD')) {
      dir += 1;
    }

    // Gamepad input (left/right analog stick or D-pad)
    if (this.gamepad && this._gamepadButtons.LEFT) {
      dir -= 1;
    }
    if (this._gamepadButtons.RIGHT) {
      dir += 1;
    }

    return dir;
  }

  /**
   * Get vertical input direction (-1, 0, or 1).
   * Supports both keyboard and gamepad.
   * @returns {number} -1 (up), 0 (none), 1 (down)
   */
  getVerticalInput() {
    let dir = 0;

    // Keyboard input
    if (this.isKeyPressed('ArrowUp') || this.isKeyPressed('KeyW')) {
      dir -= 1;
    }
    if (this.isKeyPressed('ArrowDown') || this.isKeyPressed('KeyS')) {
      dir += 1;
    }

    // Gamepad input (up/down analog stick or D-pad)
    if (this.gamepad && this._gamepadButtons.UP) {
      dir -= 1;
    }
    if (this.gamepad && this._gamepadButtons.DOWN) {
      dir += 1;
    }

    return dir;
  }

  /**
   * Check if the fire/shoot button is pressed.
   * Supports both keyboard and gamepad.
   * @returns {boolean}
   */
  isFirePressed() {
    // Keyboard: Spacebar
    const keyboardFire = this.isKeyPressed('Space');

    // Gamepad: Trigger buttons or select/start
    let gamepadFire = false;
    if (this.gamepad) {
      for (const [name, index] of Object.entries(this.gamepadButtonMap)) {
        if (index < this.gamepad.buttonCount && this._gamepadButtons[name]) {
          // Triggers are typically fire buttons on gamepads
          if (name.includes('TRIGGER') || name === 'SELECT' || name === 'START') {
            gamepadFire = true;
            break;
          }
        }
      }

      // Also check analog triggers as alternative fire method
      for (let i = 0; i < Math.min(this.gamepad.buttonCount, 12); i++) {
        if (i >= this.gamepadAxes.length) continue;
        const axisVal = this.gamepadAxes[i];
        // Triggers are typically axes 6 and 7 on standard gamepads
        if (i === 6 || i === 7 && axisVal < -0.5) {
          gamepadFire = true;
          break;
        }
      }
    }

    return keyboardFire || gamepadFire;
  }

  /**
   * Get the current gamepad axes (for analog movement).
   * @returns {number[]} Array of axis values (-1 to 1)
   */
  getGamepadAxes() {
    if (!this.gamepad) return [];
    return this.gamepadAxes.slice(); // Return a copy
  }

  /**
   * Get the current gamepad button states.
   * @returns {Object} Object with named button states
   */
  getGamepadButtons() {
    if (!this._gamepadButtons) return {};
    return this._gamepadButtons;
  }

  /**
   * Check if any gamepad is connected.
   * @returns {boolean}
   */
  hasGamepad() {
    return !!this.gamepad;
  }

  /**
   * Get the number of connected gamepads.
   * @returns {number}
   */
  getGamepadCount() {
    return (window.gamepads || []).length;
  }

  /**
   * Reset all input state to default.
   */
  reset() {
    for (const key in this.keyMap) {
      this.keyMap[key] = false;
    }
    this._gamepadButtons = {};
    this.gamepadAxes = [];
    this.gamepadButtons = new Set();
    this.gamepad = null;
  }

  /**
   * Clean up listeners when the input system is destroyed.
   */
  dispose() {
    // Remove keyboard listeners
    for (const listener of this._keyboardListeners) {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    }
    this._keyboardListeners = [];

    // Remove gamepad listeners
    this._removeGamepadListeners();
  }

  /**
   * Get a summary of the current input state for debugging.
   * @returns {Object} Input state summary
   */
  getStateSummary() {
    return {
      keyboard: Object.fromEntries(this.keyMap),
      gamepadConnected: !!this.gamepad,
      gamepadAxes: this.gamepadAxes.slice(),
      gamepadButtons: this._gamepadButtons || {},
      horizontalInput: this.getHorizontalInput(),
      verticalInput: this.getVerticalInput(),
      firePressed: this.isFirePressed(),
    };
  }
}

/**
 * Singleton instance of InputState.
 */
let inputInstance = null;

/**
 * Get the global input state instance.
 * @returns {InputState}
 */
export function getInput() {
  if (!inputInstance) {
    inputInstance = new InputState();
  }
  return inputInstance;
}

/**
 * Reset the global input state.
 */
export function resetInput() {
  if (inputInstance) {
    inputInstance.reset();
    inputInstance.dispose();
    inputInstance = null;
  }
}

/**
 * Get the current input state for a specific key or combination.
 * @param {string|Object} query - Key name or object with multiple keys
 * @returns {boolean}
 */
export function isKeyPressed(query) {
  const input = getInput();
  if (typeof query === 'string') {
    return input.isKeyPressed(query);
  } else if (Array.isArray(query)) {
    return input.isAnyKeyPressed(...query);
  } else if (typeof query === 'object' && !Array.isArray(query)) {
    for (const key of Object.keys(query)) {
      if (input.isKeyPressed(key)) return true;
    }
    return false;
  }
  return false;
}

/**
 * Check if the fire button is pressed.
 * @returns {boolean}
 */
export function isFirePressed() {
  return getInput().isFirePressed();
}

/**
 * Get horizontal input direction.
 * @returns {number} -1 (left), 0 (none), 1 (right)
 */
export function getHorizontalInput() {
  return getInput().getHorizontalInput();
}

/**
 * Get vertical input direction.
 * @returns {number} -1 (up), 0 (none), 1 (down)
 */
export function getVerticalInput() {
  return getInput().getVerticalInput();
}

/**
 * Check if any gamepad is connected.
 * @returns {boolean}
 */
export function hasGamepad() {
  return getInput().hasGamepad();
}

/**
 * Get the number of connected gamepads.
 * @returns {number}
 */
export function getGamepadCount() {
  return getInput().getGamepadCount();
}

/**
 * Reset input state and dispose of listeners.
 */
export function disposeInput() {
  if (inputInstance) {
    inputInstance.dispose();
    inputInstance = null;
  }
}