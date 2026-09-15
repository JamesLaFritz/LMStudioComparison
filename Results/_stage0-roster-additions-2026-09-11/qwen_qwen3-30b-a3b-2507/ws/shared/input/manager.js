import { Vector2 } from '../utils/math.js';

/** Unified Input Manager for Keyboard and Gamepad **/
export class InputManager {
  constructor() {
    this.keys = {};
    this.gamepads = {};
    this.axisThreshold = 0.1;
    this.deadzone = 0.1;

    // Bind events
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('gamepadconnected', (e) => {
      this.gamepads[e.gamepad.index] = e.gamepad;
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      delete this.gamepads[e.gamepad.index];
    });

    // Poll gamepads
    this.pollGamepads();
  }

  /** Poll gamepads and update state **/
  pollGamepads() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        this.gamepads[i] = gamepads[i];
      }
    }
    requestAnimationFrame(() => this.pollGamepads());
  }

  /** Get direction vector from keyboard and gamepad **/
  getDirection() {
    const dir = new Vector2(0, 0);

    // Keyboard: WASD or Arrow keys
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dir.y = 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dir.y = -1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dir.x = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dir.x = 1;

    // Gamepad: Left stick
    const gamepad = Object.values(this.gamepads)[0];
    if (gamepad) {
      const leftStick = gamepad.axes[0]; // X
      const upStick = gamepad.axes[1]; // Y

      // Apply deadzone
      if (Math.abs(leftStick) > this.deadzone) dir.x = leftStick;
      if (Math.abs(upStick) > this.deadzone) dir.y = upStick;
    }

    // Normalize
    if (dir.length() > 0) dir.normalize();
    return dir;
  }

  /** Check if a key is pressed **/
  isPressed(key) {
    return this.keys[key] || false;
  }

  /** Check if a button is pressed on any gamepad **/
  isButtonPressed(buttonIndex) {
    for (const gamepad of Object.values(this.gamepads)) {
      if (gamepad.buttons[buttonIndex]?.pressed) return true;
    }
    return false;
  }

  /** Get button state **/
  getButton(buttonIndex) {
    for (const gamepad of Object.values(this.gamepads)) {
      if (gamepad.buttons[buttonIndex]) return gamepad.buttons[buttonIndex];
    }
    return null;
  }
}

// Export singleton
export const inputManager = new InputManager();
