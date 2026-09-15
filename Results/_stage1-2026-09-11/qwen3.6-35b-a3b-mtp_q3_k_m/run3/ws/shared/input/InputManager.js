export class InputManager {
  constructor() {
    this.keys = {};
    this.gamepadIndex = null;
    this.deadzone = 0.25;

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      e.preventDefault();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('gamepadconnected', () => {
      if (this.gamepadIndex === null) {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
          if (gamepads[i]) {
            this.gamepadIndex = i;
            break;
          }
        }
      }
    });

    window.addEventListener('gamepaddisconnected', () => {
      const gamepads = navigator.getGamepads();
      let found = false;
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          this.gamepadIndex = i;
          found = true;
          break;
        }
      }
      if (!found) this.gamepadIndex = null;
    });
  }

  getAxis(axisName) {
    let value = 0;

    // Keyboard input
    switch (axisName) {
      case 'left':
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) value -= 1;
        break;
      case 'right':
        if (this.keys['ArrowRight'] || this.keys['KeyD']) value += 1;
        break;
      case 'up':
        if (this.keys['ArrowUp'] || this.keys['KeyW']) value += 1;
        break;
      case 'down':
        if (this.keys['ArrowDown'] || this.keys['KeyS']) value -= 1;
        break;
    }

    // Gamepad input
    if (this.gamepadIndex !== null) {
      const gamepad = navigator.getGamepads()[this.gamepadIndex];
      if (gamepad) {
        switch (axisName) {
          case 'left':
            if (gamepad.axes[0] < -this.deadzone) value -= 1;
            break;
          case 'right':
            if (gamepad.axes[0] > this.deadzone) value += 1;
            break;
          case 'up':
            if (gamepad.axes[1] < -this.deadzone) value += 1;
            break;
          case 'down':
            if (gamepad.axes[1] > this.deadzone) value -= 1;
            break;
        }
      }
    }

    return Math.max(-1, Math.min(1, value));
  }

  isButtonPressed(buttonId) {
    // Keyboard: space for fire
    if (buttonId === 'fire') {
      if (this.keys['Space']) return true;
    }

    // Gamepad button
    if (this.gamepadIndex !== null) {
      const gamepad = navigator.getGamepads()[this.gamepadIndex];
      if (gamepad && gamepad.buttons[buttonId]) {
        return gamepad.buttons[buttonId].pressed;
      }
    }

    return false;
  }

  update() {
    // Poll gamepad state each frame for continuous input
  }
}