// shared/Input/InputController.js
// Unified dual-input: Keyboard (WASD/Arrows) + Gamepad API

export class InputController {
  constructor() {
    this.keys = {};
    this.gamepadIndex = null;
    this.deadzone = 0.2;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _onKeyDown(e) { this.keys[e.code] = true; }
  _onKeyUp(e) { this.keys[e.code] = false; }

  /** Poll gamepads each frame (navigator.getGamepads changes) */
  _pollGamepad() {
    if (this.gamepadIndex === null) return null;
    const gamepads = navigator.getGamepads();
    return gamepads[this.gamepadIndex] || null;
  }

  /** Try to connect first available gamepad */
  connectGamepad() {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) { this.gamepadIndex = i; return true; }
    }
    return false;
  }

  /**
   * Get unified 2D axis input.
   * Returns { x: -1..1, y: -1..1 }
   * Keyboard: WASD / Arrows
   * Gamepad: Left stick or D-pad
   */
  getAxis() {
    let x = 0, y = 0;

    // Keyboard
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) x -= 1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) x += 1;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) y -= 1;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) y += 1;

    // Gamepad (overrides keyboard if active)
    const gp = this._pollGamepad();
    if (gp) {
      const lx = gp.axes[0];
      const ly = gp.axes[1];
      if (Math.abs(lx) > this.deadzone) x = lx;
      if (Math.abs(ly) > this.deadzone) y = ly;
      // D-pad
      if (gp.buttons[12] && gp.buttons[12].pressed) x = Math.max(x, -1);
      if (gp.buttons[13] && gp.buttons[13].pressed) x = Math.min(x, 1);
      if (gp.buttons[14] && gp.buttons[14].pressed) y = Math.max(y, -1);
      if (gp.buttons[15] && gp.buttons[15].pressed) y = Math.min(y, 1);
    }

    return { x, y };
  }

  /** Get button state (space / Z / gamepad button 0) */
  getButton() {
    if (this.keys['Space'] || this.keys['KeyZ']) return true;
    const gp = this._pollGamepad();
    if (gp && gp.buttons[0] && gp.buttons[0].pressed) return true;
    return false;
  }

  /** Get secondary button (Shift / X / gamepad button 1) */
  getButton2() {
    if (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyX']) return true;
    const gp = this._pollGamepad();
    if (gp && gp.buttons[1] && gp.buttons[1].pressed) return true;
    return false;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
