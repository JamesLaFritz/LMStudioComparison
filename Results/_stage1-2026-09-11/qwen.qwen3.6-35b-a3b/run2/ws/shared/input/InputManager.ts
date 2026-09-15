import { GamepadAPI } from './GamepadAPI.js';

export class InputManager {
  private keys: Set<string> = new Set();
  private justPressed: Set<string> = new Set();
  public gamepad: GamepadAPI;
  private animFrameId: number | null = null;

  constructor() {
    this.gamepad = new GamepadAPI();
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    });
  }

  startPolling(): void {
    this.gamepad.startPolling();
    const tick = () => {
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  stopPolling(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.gamepad.stopPolling();
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  justPressed(code: string): boolean {
    const result = this.justPressed.has(code);
    if (result) this.justPressed.delete(code);
    return result;
  }

  get horizontalInput(): number {
    let val = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) val -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) val += 1;
    // Gamepad override: stick takes priority over keys
    if (Math.abs(this.gamepad.axisXRaw) > 0.1) {
      val = Math.sign(this.gamepad.axisXRaw);
    }
    return val;
  }

  get fireInput(): boolean {
    return this.isDown('Space') || this.gamepad.firePressed;
  }

  get fireJustPressed(): boolean {
    return this.justPressed('Space') || this.gamepad.fireJustPressed;
  }

  dispose(): void {
    this.stopPolling();
    this.keys.clear();
    this.justPressed.clear();
    this.gamepad.dispose();
  }
}