/**
 * Gamepad API wrapper with state tracking and deadzone support.
 */

export class GamepadState {
  private gamepads: Gamepad[] = [];
  private prevAxes: number[][] = [];
  private prevButtons: boolean[][] = [];

  /** Poll all connected gamepads and return the first active one, or null. */
  poll(): Gamepad | null {
    const gpList = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    
    // Detect new gamepads
    for (let i = 0; i < gpList.length; i++) {
      if (!this.gamepads[i] && gpList[i]) {
        this.gamepads[i] = gpList[i];
        while (this.prevAxes.length <= i) this.prevAxes.push([]);
        while (this.prevButtons.length <= i) this.prevButtons.push([]);
      }
    }

    // Update existing gamepad data
    for (let i = 0; i < this.gamepads.length; i++) {
      if (gpList[i]) {
        this.gamepads[i] = gpList[i];
      } else {
        this.gamepads[i] = null as any; // mark as disconnected
      }
    }

    // Return first connected gamepad
    for (let i = 0; i < this.gamepads.length; i++) {
      if (this.gamepads[i]) return this.gamepads[i];
    }
    return null;
  }

  /** Get a gamepad axis value with deadzone filtering. */
  getAxis(gamepad: Gamepad | null, axisIndex: number, deadzone: number = 0.15): number {
    if (!gamepad) return 0;
    const axes = gamepad.axes || [];
    if (axisIndex >= axes.length) return 0;
    let val = axes[axisIndex];
    // Apply deadzone
    if (Math.abs(val) < deadzone) val = 0;
    return val;
  }

  /** Check if a gamepad button was just pressed this frame. */
  getButtonJustPressed(gamepad: Gamepad | null, buttonIndex: number): boolean {
    if (!gamepad) return false;
    const buttons = gamepad.buttons || [];
    if (buttonIndex >= buttons.length) return false;
    const pressed = buttons[buttonIndex].pressed;
    
    // Ensure previous state array exists
    while (this.prevButtons.length <= buttonIndex) {
      this.prevButtons.push(false);
    }
    
    const wasPressed = this.prevButtons[buttonIndex];
    this.prevButtons[buttonIndex] = pressed;
    return pressed && !wasPressed;
  }

  /** Check if a gamepad button is currently held. */
  getButtonHeld(gamepad: Gamepad | null, buttonIndex: number): boolean {
    if (!gamepad) return false;
    const buttons = gamepad.buttons || [];
    if (buttonIndex >= buttons.length) return false;
    return buttons[buttonIndex].pressed;
  }

  /** Check if a gamepad is connected. */
  isConnected(gamepad: Gamepad | null): boolean {
    return gamepad !== null && gamepad.connected;
  }

  /** Reset previous button states (e.g., on state change). */
  reset(): void {
    this.prevAxes = [];
    this.prevButtons = [];
  }
}
