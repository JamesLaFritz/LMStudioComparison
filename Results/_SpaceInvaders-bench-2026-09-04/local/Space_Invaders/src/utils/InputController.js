export class InputController {
  constructor() {
    this.keys = {};
    this._justPressedKeys = {};
    this.gamepadIndex = null;
    this.prevKeys = {};

    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });
  }

  update() {
    // Capture just-pressed keys (current frame only)
    for (const key in this.keys) {
      if (this.keys[key] && !this.prevKeys[key]) {
        this._justPressedKeys[key] = true;
      }
    }
    // Clear after reading
    const just = { ...this._justPressedKeys };
    this._justPressedKeys = {};
    this.prevKeys = { ...this.keys };

    // Update gamepad state
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) { this.gamepadIndex = i; break; }
    }

    return just;
  }

  getAxis(axis) {
    let val = 0;
    switch (axis) {
      case 'horizontal':
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) val -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) val += 1;
        const gp = navigator.getGamepads ? navigator.getGamepads()[this.gamepadIndex] : null;
        if (gp && Math.abs(gp.axes[0]) > 0.2) val = gp.axes[0];
        break;
    }
    return val;
  }

  justPressed(action) {
    switch (action) {
      case 'fire':
        // Keyboard: Space or Enter
        if (this.keys['Space'] || this.keys['Enter']) return true;
        // Gamepad: A button (button 0)
        const gp = navigator.getGamepads ? navigator.getGamepads()[this.gamepadIndex] : null;
        if (gp && gp.buttons[0].pressed) return true;
        break;
    }
    return false;
  }

  dispose() {
    // No listeners to remove (we only add in constructor, kept for lifetime of page)
  }
}
