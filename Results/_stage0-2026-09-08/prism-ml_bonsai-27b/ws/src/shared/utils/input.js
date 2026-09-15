// src/shared/utils/input.js
// Unified Dual-Input: Keyboard (WASD/Arrows) + Gamepad API
// Returns a unified input state object that both systems can consume

export class InputManager {
  constructor() {
    this.keys = {};
    this.gamepadLeft = { up: false, down: false, left: false, right: false };
    this.gamepadRight = { up: false, down: false, left: false, right: false };
    this.gamepadButtons = new Set(); // A/B/X/Y mapped to gamepad buttons
    this._bound = null;

    this._bindKeyboard();
    this._bindGamepads();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  _bindGamepads() {
    const onConnect = (device) => {
      if (!this._bound) {
        this._bound = device;
        this.gamepadLeft.up = device.getButton(0);
        this.gamepadLeft.down = device.getButton(1);
        this.gamepadLeft.left = device.getButton(2);
        this.gamepadLeft.right = device.getButton(3);
      } else {
        const idx = Array.from(device.getButtons()).indexOf(true);
        if (idx >= 0) this.gamepadButtons.add(idx);
      }
    };

    const onDisconnect = () => {
      this._bound = null;
      this.gamepadLeft.up = false;
      this.gamepadLeft.down = false;
      this.gamepadLeft.left = false;
      this.gamepadLeft.right = false;
      this.gamepadButtons.clear();
    };

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
  }

  update() {
    // Normalize keyboard to directional state
    const kLeft = this.keys['ArrowLeft'] || this.keys['KeyA'];
    const kRight = this.keys['ArrowRight'] || this.keys['KeyD'];
    const kUp = this.keys['ArrowUp'] || this.keys['KeyW'];
    const kDown = this.keys['ArrowDown'] || this.keys['KeyS'];

    // Gamepad priority when both are present
    if (this._bound) {
      this.gamepadLeft.up = this.gamepadLeft.up;
      this.gamepadLeft.down = this.gamepadLeft.down;
      this.gamepadLeft.left = this.gamepadLeft.left;
      this.gamepadLeft.right = this.gamepadLeft.right;
    }

    // Map to unified directional state (gamepad overrides keyboard when connected)
    const dirUp = this._bound ? this.gamepadLeft.up : kUp;
    const dirDown = this._bound ? this.gamepadLeft.down : kDown;
    const dirLeft = this._bound ? this.gamepadLeft.left : kLeft;
    const dirRight = this._bound ? this.gamepadLeft.right : kRight;

    return {
      up: dirUp,
      down: dirDown,
      left: dirLeft,
      right: dirRight,
      fire: this.keys['Space'] || this.keys['KeyF'],
      gamepadButtons: new Set(this.gamepadButtons),
      isGamepadConnected: !!this._bound,
    };
  }

  getDirection() {
    const dx = (this.keys['ArrowLeft'] || this.keys['KeyA']) ? -1 : 0;
    if (!dx && (this.keys['ArrowRight'] || this.keys['KeyD']) ? 1 : 0) return dx;
    const dy = (this.keys['ArrowUp'] || this.keys['KeyW']) ? -1 : 0;
    if (!dy && (this.keys['ArrowDown'] || this.keys['KeyS']) ? 1 : 0) return dy;
    return { x: dx, y: dy };
  }

  isPressed(code) {
    return !!this.keys[code];
  }

  getGamepadButton(idx) {
    if (this._bound && idx >= 0 && idx < this._bound.getButtonCount()) {
      return this._bound.getButton(idx);
    }
    return false;
  }
}

export const input = new InputManager();