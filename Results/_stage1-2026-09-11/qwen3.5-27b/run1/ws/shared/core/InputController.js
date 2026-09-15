/**
 * Unified Input Controller — Keyboard + Gamepad API
 * Supports WASD, Arrow keys, and standard gamepad mapping
 */

export class InputController {
  constructor() {
    // Keyboard state
    this.keys = new Set();
    
    // Gamepad state (polling)
    this.gamepadIndex = null;
    this.gamepadButtons = new Map();
    
    // Setup listeners
    this._setupKeyboardListeners();
    this._setupGamepadListeners();
  }

  _setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) {
        this.keys.add(e.code);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  _setupGamepadListeners() {
    // Gamepad connected
    window.addEventListener('gamepadconnected', (e) => {
      if (this.gamepadIndex === null) {
        this.gamepadIndex = e.gamepad.index;
        console.log(`Gamepad connected: ${e.gamepad.id}`);
      }
    });

    // Gamepad disconnected
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
        this.gamepadButtons.clear();
        console.log('Gamepad disconnected');
      }
    });
  }

  /**
   * Poll gamepad state — must be called every frame
   */
  update() {
    if (this.gamepadIndex !== null) {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[this.gamepadIndex];
      
      if (gp) {
        // Update button states
        for (let i = 0; i < gp.buttons.length; i++) {
          const pressed = gp.buttons[i].pressed;
          this.gamepadButtons.set(i, pressed);
        }
        
        // Store axis values for quick access
        this._gamepadAxes = gp.axes;
      } else {
        this.gamepadIndex = null;
        this.gamepadButtons.clear();
      }
    }
  }

  /**
   * Check if a keyboard key is pressed
   */
  isKeyDown(code) {
    return this.keys.has(code);
  }

  /**
   * Get horizontal input axis (-1 to 1)
   * Keyboard: A/D or Left/Right arrows
   * Gamepad: Left stick X or D-pad left/right
   */
  getHorizontalAxis() {
    let value = 0;

    // Keyboard
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      value -= 1;
    }
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      value += 1;
    }

    // Gamepad (left stick or D-pad)
    if (this._gamepadAxes && this._gamepadAxes.length > 0) {
      const gpValue = this._gamepadAxes[0]; // Left stick X
      // Deadzone handling
      if (Math.abs(gpValue) > 0.1) {
        value = gpValue;
      }
    }

    return Math.max(-1, Math.min(1, value));
  }

  /**
   * Get vertical input axis (-1 to 1)
   */
  getVerticalAxis() {
    let value = 0;

    // Keyboard
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      value -= 1;
    }
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      value += 1;
    }

    // Gamepad (left stick Y - inverted for screen coords)
    if (this._gamepadAxes && this._gamepadAxes.length > 1) {
      const gpValue = this._gamepadAxes[1];
      if (Math.abs(gpValue) > 0.1) {
        value = -gpValue; // Invert for screen coordinates
      }
    }

    return Math.max(-1, Math.min(1, value));
  }

  /**
   * Check fire button press
   * Keyboard: Space, Enter, or K
   * Gamepad: A button (0) or X button (2)
   */
  isFirePressed() {
    // Keyboard
    if (this.keys.has('Space') || this.keys.has('Enter') || this.keys.has('KeyK')) {
      return true;
    }

    // Gamepad
    if (this.gamepadButtons.get(0) || this.gamepadButtons.get(2)) {
      return true;
    }

    return false;
  }

  /**
   * Check pause toggle
   * Keyboard: Escape or P
   * Gamepad: Start button (9) or Options
   */
  isPausePressed() {
    if (this.keys.has('Escape') || this.keys.has('KeyP')) {
      return true;
    }

    // Gamepad start button
    if (this.gamepadButtons.get(9)) {
      return true;
    }

    return false;
  }

  /**
   * Check restart/confirm action
   */
  isConfirmPressed() {
    if (this.keys.has('Enter') || this.keys.has('Space')) {
      return true;
    }
    if (this.gamepadButtons.get(0)) { // A button
      return true;
    }
    return false;
  }

  /**
   * Check cancel action
   */
  isCancelPressed() {
    if (this.keys.has('Escape')) {
      return true;
    }
    if (this.gamepadButtons.get(1)) { // B button
      return true;
    }
    return false;
  }

  /**
   * Get raw gamepad axis value by index
   */
  getGamepadAxis(index) {
    if (this._gamepadAxes && this._gamepadAxes[index] !== undefined) {
      return this._gamepadAxes[index];
    }
    return 0;
  }

  /**
   * Get raw gamepad button state by index
   */
  getGamepadButton(index) {
    return this.gamepadButtons.get(index) || false;
  }

  /**
   * Check if any input device is active
   */
  hasInput() {
    return this.keys.size > 0 || this.gamepadIndex !== null;
  }

  /**
   * Clear all keyboard state (useful for debugging or reset)
   */
  clearKeyboard() {
    this.keys.clear();
  }
}
