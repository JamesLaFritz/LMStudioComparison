/**
 * Unified dual-input controller supporting Keyboard + Gamepad API.
 */

import { GamepadState } from './Gamepad';

export type ActionName = 'moveLeft' | 'moveRight' | 'fire' | 'pause';

interface ActionMap {
  [key: string]: boolean;
}

export class InputManager {
  private gamepadState: GamepadState;
  private keysDown: Set<string> = new Set();
  private actions: ActionMap = {};
  private actionMap: Record<ActionName, string[]>;
  private gamepadIndex: number = 0;
  private lastPollTime: number = 0;

  constructor() {
    this.gamepadState = new GamepadState();
    this.actionMap = {
      moveLeft: ['ArrowLeft', 'KeyA'],
      moveRight: ['ArrowRight', 'KeyD'],
      fire: ['Space', 'Enter', 'ShiftLeft', 'ShiftRight'],
      pause: ['Escape', 'KeyP'],
    };
    this.setupKeyboardListeners();
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      this.keysDown.add(e.code);
      e.preventDefault();
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
    });
  }

  /** Poll all inputs and update the action map. Call once per frame. */
  poll(): ActionMap {
    const result: ActionMap = {};

    // Evaluate each action against keyboard state
    for (const [action, keys] of Object.entries(this.actionMap)) {
      let pressed = false;
      for (const key of keys) {
        if (this.keysDown.has(key)) {
          pressed = true;
          break;
        }
      }
      result[action] = pressed;
    }

    // Evaluate each action against gamepad state
    const gp = this.gamepadState.poll();
    if (gp && this.gamepadState.isConnected(gp)) {
      // Gamepad axes for movement (axis 0 is left stick X)
      const axisX = this.gamepadState.getAxis(gp, 0);
      if (result['moveLeft'] || axisX < -0.15) result['moveLeft'] = true;
      if (result['moveRight'] || axisX > 0.15) result['moveRight'] = true;

      // Gamepad buttons for fire (button 0 = A/Cross, button 7 = Right Trigger)
      if (result['fire'] || this.gamepadState.getButtonHeld(gp, 0) || this.gamepadState.getButtonHeld(gp, 7)) {
        result['fire'] = true;
      }

      // Pause
      if (this.gamepadState.getButtonJustPressed(gp, 12) || this.gamepadState.getButtonJustPressed(gp, 8)) {
        result['pause'] = true;
      }
    }

    this.actions = result;
    return result;
  }

  /** Get the current state of an action. */
  getAction(action: ActionName): boolean {
    return !!this.actions[action];
  }

  /** Check if a gamepad is currently connected. */
  hasGamepad(): boolean {
    const gp = this.gamepadState.poll();
    return gp !== null && this.gamepadState.isConnected(gp);
  }

  /** Reset all input state (useful on menu transitions). */
  reset(): void {
    this.keysDown.clear();
    this.actions = {};
    this.gamepadState.reset();
  }

  /** Dispose of event listeners. */
  dispose(): void {
    window.removeEventListener('keydown', this.onKeydown);
    window.removeEventListener('keyup', this.onKeyup);
  }

  private onKeydown = (e: KeyboardEvent): void => {
    this.keysDown.add(e.code);
    e.preventDefault();
  };

  private onKeyup = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };
}