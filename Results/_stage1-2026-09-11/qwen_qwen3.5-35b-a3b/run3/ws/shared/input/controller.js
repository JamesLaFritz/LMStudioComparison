import * as THREE from 'three';

export class InputController {
  constructor() {
    this.keys = {};
    this.gamepadIndex = null;
    this.deadZone = 0.15;
    
    // Keyboard event listeners
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    
    // Gamepad connection events
    window.addEventListener('gamepadconnected', (e) => this.onGamepadConnected(e));
    window.addEventListener('gamepaddisconnected', (e) => this.onGamepadDisconnected(e));
  }

  onKeyDown(event) {
    this.keys[event.code] = true;
    
    // Prevent scrolling with arrow keys/space
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  onKeyUp(event) {
    this.keys[event.code] = false;
  }

  onGamepadConnected(event) {
    console.log('Gamepad connected:', event.gamepad.id);
    this.gamepadIndex = event.gamepad.index;
  }

  onGamepadDisconnected(event) {
    if (this.gamepadIndex === event.gamepad.index) {
      this.gamepadIndex = null;
    }
  }

  getAxis(axisName) {
    // Check gamepad first, then keyboard
    const gamepadInput = this.getGamepadAxis(axisName);
    if (gamepadInput !== null && Math.abs(gamepadInput) > this.deadZone) {
      return gamepadInput;
    }

    const keyInput = this.getKeyboardAxis(axisName);
    if (keyInput !== null && Math.abs(keyInput) > this.deadZone) {
      return keyInput;
    }

    return 0;
  }

  getGamepadAxis(axisName) {
    if (this.gamepadIndex === null) return null;
    
    const gamepads = navigator.getGamepads();
    if (!gamepads[this.gamepadIndex]) return null;
    
    const gp = gamepads[this.gamepadIndex];
    
    switch (axisName) {
      case 'horizontal':
        // Left stick X or D-pad left/right
        const leftStickX = gp.axes[0] !== undefined ? gp.axes[0] : 0;
        const rightStickX = gp.axes[6] !== undefined ? gp.axes[6] : 0;
        return Math.abs(leftStickX) > this.deadZone ? leftStickX : 
               Math.abs(rightStickX) > this.deadZone ? rightStickX : 0;
      
      case 'vertical':
        // Left stick Y or D-pad up/down
        const leftStickY = gp.axes[1] !== undefined ? gp.axes[1] : 0;
        return Math.abs(leftStickY) > this.deadZone ? -leftStickY : 0;
      
      default:
        return null;
    }
  }

  getKeyboardAxis(axisName) {
    switch (axisName) {
      case 'horizontal':
        const left = this.keys['ArrowLeft'] || this.keys['KeyA'];
        const right = this.keys['ArrowRight'] || this.keys['KeyD'];
        return (right ? 1 : 0) - (left ? 1 : 0);
      
      case 'vertical':
        const up = this.keys['ArrowUp'] || this.keys['KeyW'];
        const down = this.keys['ArrowDown'] || this.keys['KeyS'];
        return (up ? 1 : 0) - (down ? 1 : 0);
      
      default:
        return null;
    }
  }

  isActionPressed(actionName) {
    // Check gamepad button first, then keyboard
    const gamepadInput = this.getGamepadButton(actionName);
    if (gamepadInput !== null && gamepadInput) {
      return true;
    }

    const keyInput = this.getKeyboardButton(actionName);
    if (keyInput !== null && keyInput) {
      return true;
    }

    return false;
  }

  getGamepadButton(buttonName) {
    if (this.gamepadIndex === null) return null;
    
    const gamepads = navigator.getGamepads();
    if (!gamepads[this.gamepadIndex]) return null;
    
    const gp = gamepads[this.gamepadIndex];
    
    switch (buttonName) {
      case 'shoot':
        // A button (Xbox) or Cross (PlayStation) - usually button 0
        return gp.buttons[0]?.pressed || false;
      
      case 'start':
        // Start button - usually button 9
        return gp.buttons[9]?.pressed || false;
      
      default:
        return null;
    }
  }

  getKeyboardButton(buttonName) {
    switch (buttonName) {
      case 'shoot':
        return this.keys['Space'] || this.keys['KeyF'];
      
      case 'start':
        return this.keys['Enter'] || this.keys['Escape'];
      
      default:
        return null;
    }
  }

  hasGamepad() {
    return this.gamepadIndex !== null && navigator.getGamepads()[this.gamepadIndex] !== null;
  }

  update() {
    // Poll gamepad state each frame
    const gamepads = navigator.getGamepads();
    if (this.gamepadIndex !== null) {
      const gp = gamepads[this.gamepadIndex];
      if (!gp) {
        this.gamepadIndex = null;
      }
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }
}