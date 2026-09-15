/**
 * Unified Input Manager - Keyboard + Gamepad support
 * Handles input state, deadzone calibration, and auto-switching between controllers
 */

export type InputVector = { x: number; y: number };

export class InputManager {
  private keyboardState: Map<string, boolean> = new Map();
  private gamepadIndex: number | null = null;
  private gamepadDeadzone: number = 0.15;
  private lastGamepadPollTime: number = 0;
  
  // Input bindings
  private keyBindings: { [key: string]: string } = {
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'a': 'left',
    'A': 'left',
    'd': 'right',
    'D': 'right',
    ' ': 'shoot',
    'Enter': 'start',
    'Escape': 'pause'
  };

  constructor() {
    this.setupKeyboardListeners();
    this.pollGamepad(); // Initial poll to detect connected controllers
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      if (this.keyBindings[e.code]) {
        this.keyboardState.set(this.keyBindings[e.code], true);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keyBindings[e.code]) {
        this.keyboardState.set(this.keyBindings[e.code], false);
      }
    });
  }

  private pollGamepad(): void {
    const gamepads = navigator.getGamepads();
    
    // Find first connected gamepad if not already set
    if (this.gamepadIndex === null) {
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          this.gamepadIndex = i;
          break;
        }
      }
    } else if (!gamepads[this.gamepadIndex]) {
      // Gamepad disconnected, try to find another
      this.gamepadIndex = null;
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          this.gamepadIndex = i;
          break;
        }
      }
    }

    this.lastGamepadPollTime = performance.now();
  }

  private getGamepadAxis(axisIndex: number): number {
    if (this.gamepadIndex === null) return 0;
    
    const gamepad = navigator.getGamepads()[this.gamepadIndex];
    if (!gamepad || !gamepad.axes[axisIndex]) return 0;
    
    const value = gamepad.axes[axisIndex];
    // Apply deadzone
    return Math.abs(value) > this.gamepadDeadzone ? value : 0;
  }

  private getGamepadButton(buttonIndex: number): boolean {
    if (this.gamepadIndex === null) return false;
    
    const gamepad = navigator.getGamepads()[this.gamepadIndex];
    if (!gamepad || !gamepad.buttons[buttonIndex]) return false;
    
    return gamepad.buttons[buttonIndex].pressed;
  }

  private getKeyboardInput(): InputVector {
    let x = 0;
    let y = 0;

    if (this.keyboardState.get('left')) x -= 1;
    if (this.keyboardState.get('right')) x += 1;
    
    // Vertical movement for games that support it
    if (this.keyboardState.get('up')) y += 1;
    if (this.keyboardState.get('down')) y -= 1;

    return { x, y };
  }

  getMovementInput(): InputVector {
    const keyboardInput = this.getKeyboardInput();
    
    // Prioritize gamepad if recently polled and has input
    const gamepadX = this.getGamepadAxis(0);
    const gamepadY = this.getGamepadAxis(1);
    
    // Use gamepad if it has significant input, otherwise keyboard
    if (Math.abs(gamepadX) > 0 || Math.abs(gamepadY) > 0) {
      return { x: gamepadX, y: gamepadY };
    }
    
    return keyboardInput;
  }

  isShooting(): boolean {
    const keyboardShoot = this.keyboardState.get('shoot');
    const gamepadShoot = this.getGamepadButton(0); // A button on Xbox, Cross on PlayStation
    
    return keyboardShoot || gamepadShoot;
  }

  isStarting(): boolean {
    const keyboardStart = this.keyboardState.get('start');
    const gamepadStart = this.getGamepadButton(9); // Start button
    
    if (keyboardStart) {
      this.keyboardState.set('start', false); // Consume event
      return true;
    }
    
    if (gamepadStart) {
      return true;
    }
    
    return false;
  }

  isPausing(): boolean {
    const keyboardPause = this.keyboardState.get('pause');
    const gamepadPause = this.getGamepadButton(8); // Back button
    
    if (keyboardPause) {
      this.keyboardState.set('pause', false); // Consume event
      return true;
    }
    
    if (gamepadPause) {
      return true;
    }
    
    return false;
  }

  update(deltaTime: number): void {
    // Poll gamepad every frame for smooth input
    this.pollGamepad();
  }

  setDeadzone(deadzone: number): void {
    this.gamepadDeadzone = deadzone;
  }

  getConnectedGamepads(): number {
    const gamepads = navigator.getGamepads();
    let count = 0;
    
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) count++;
    }
    
    return count;
  }
}

export const inputManager = new InputManager();