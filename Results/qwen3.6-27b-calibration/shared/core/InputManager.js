/**
 * InputManager — Unified Keyboard + Gamepad API input.
 * Shared across all games.
 */

export class InputManager {
  constructor() {
    this.keys = {};
    this.prevKeys = {};
    this.gamepadIndex = null;
    this.actions = {};
    this.actionBindings = {};
    this._initKeyboard();
  }

  _initKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  /**
   * Bind an action name to keyboard codes and/or gamepad buttons/axes.
   * Example: bind('moveUp', { keys: ['KeyW', 'ArrowUp'], gamepadAxis: [1, -1] })
   */
  bind(actionName, config) {
    this.actionBindings[actionName] = config;
  }

  /**
   * Check if an action is currently active (held).
   */
  isActionActive(actionName) {
    const binding = this.actionBindings[actionName];
    if (!binding) return false;

    // Check keyboard
    if (binding.keys) {
      for (const key of binding.keys) {
        if (this.keys[key]) return true;
      }
    }

    // Check gamepad
    if (this._hasGamepad()) {
      const gp = navigator.getGamepads()[this.gamepadIndex];
      if (gp) {
        if (binding.gamepadButton !== undefined) {
          if (gp.buttons[binding.gamepadButton] && gp.buttons[binding.gamepadButton].pressed) return true;
        }
        if (binding.gamepadAxis !== undefined) {
          const [axis, threshold] = binding.gamepadAxis;
          if (axis !== undefined && gp.axes[axis] !== undefined) {
            if (Math.abs(gp.axes[axis]) > (threshold || 0.5)) return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if an action was just pressed this frame.
   */
  isActionPressed(actionName) {
    const now = this.isActionActive(actionName);
    const prev = this.actions[actionName] || false;
    return now && !prev;
  }

  /**
   * Get the analog value for an action (for gamepad axes).
   * Returns -1, 0, or 1 for keyboard; actual axis value for gamepad.
   */
  getActionAxis(actionName) {
    const binding = this.actionBindings[actionName];
    if (!binding) return 0;

    // Check gamepad first for analog
    if (this._hasGamepad()) {
      const gp = navigator.getGamepads()[this.gamepadIndex];
      if (gp && binding.gamepadAxis !== undefined) {
        const [axis] = binding.gamepadAxis;
        if (axis !== undefined && gp.axes[axis] !== undefined) {
          const deadzone = 0.15;
          let val = gp.axes[axis];
          if (Math.abs(val) < deadzone) return 0;
          return val;
        }
      }
    }

    // Keyboard fallback: return -1 or 1
    if (binding.keys) {
      const negKeys = binding.negKeys || [];
      for (const key of negKeys) {
        if (this.keys[key]) return -1;
      }
      for (const key of binding.keys) {
        if (this.keys[key]) return 1;
      }
    }

    return 0;
  }

  /**
   * Poll gamepad connections.
   */
  pollGamepads() {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        this.gamepadIndex = i;
        return;
      }
    }
  }

  _hasGamepad() {
    return this.gamepadIndex !== null;
  }

  /**
   * Update action state tracking (call once per frame).
   */
  update() {
    this.pollGamepads();
    for (const name in this.actionBindings) {
      this.prevKeys[name] = this.actions[name];
      this.actions[name] = this.isActionActive(name);
    }
  }

  /**
   * Check if a specific key code was just pressed.
   */
  isKeyPressed(code) {
    return this.keys[code] && !this.prevKeys[code];
  }

  /**
   * Check if a specific key code is currently held.
   */
  isKeyHeld(code) {
    return !!this.keys[code];
  }

  /**
   * Snapshot current key states (call at end of frame).
   */
  snapshot() {
    for (const key in this.keys) {
      this.prevKeys[key] = this.keys[key];
    }
  }
}
