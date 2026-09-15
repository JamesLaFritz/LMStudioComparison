import * as THREE from 'three';
import type { Vector3f } from '../types.js';

const GAMEPAD_INDEX = 0;
const DEAD_ZONE = 0.12;
const MAPPED_RANGE = 1.0;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class GamepadAPI {
  private connected: boolean = false;
  private axisX: number = 0;
  private axisY: number = 0;
  private buttonFire: boolean = false;
  private prevButtonFire: boolean = false;
  private pollInterval: number | null = null;

  get isGamepadConnected(): boolean { return this.connected; }
  get axisXRaw(): number { return this.axisX; }
  get axisYRaw(): number { return this.axisY; }
  get firePressed(): boolean { return this.buttonFire; }
  get fireJustPressed(): boolean { return this.buttonFire && !this.prevButtonFire; }

  private updateGamepad(): void {
    const gamepads = navigator.gamepads || (navigator as any).webkitGamepads;
    if (!gamepads) {
      this.connected = false;
      this.axisX = 0;
      this.axisY = 0;
      this.buttonFire = false;
      return;
    }

    const gp = gamepads[GAMEPAD_INDEX];
    if (!gp) {
      this.connected = false;
      this.axisX = 0;
      this.axisY = 0;
      this.buttonFire = false;
      return;
    }

    this.connected = true;

    // Left stick X (axis 0)
    let rawX = gp.axes[0] ?? 0;
    if (Math.abs(rawX) < DEAD_ZONE) rawX = 0;
    else rawX = clamp(rawX * MAPPEd_RANGE, -1, 1);

    // Left stick Y (axis 1) — inverted for game coords (up = positive)
    let rawY = -(gp.axes[1] ?? 0);
    if (Math.abs(rawY) < DEAD_ZONE) rawY = 0;
    else rawY = clamp(rawY * MAPPEd_RANGE, -1, 1);

    this.axisX = rawX;
    this.axisY = rawY;

    // Button mapping: A = fire (usually button 0), or South face
    this.buttonFire = false;
    if (gp.buttons.length > 0) {
      const btnA = gp.buttons[0];
      if (btnA && typeof btnA === 'object' && 'pressed' in btnA && (btnA as any).pressed) {
        this.buttonFire = true;
      }
    }
    // Also check D-pad (common mappings: 12=down, 13=left, 14=right, 15=up)
    if (!this.buttonFire && gp.buttons.length > 12) {
      for (let i = 12; i <= 15; i++) {
        const btn = gp.buttons[i];
        if (btn && typeof btn === 'object' && 'pressed' in btn && (btn as any).pressed) {
          this.buttonFire = true;
          break;
        }
      }
    }

    this.prevButtonFire = this.buttonFire;
  }

  startPolling(): void {
    if (this.pollInterval !== null) return;
    const tick = () => {
      this.updateGamepad();
      this.pollInterval = requestAnimationFrame(tick);
    };
    this.pollInterval = requestAnimationFrame(tick);
  }

  stopPolling(): void {
    if (this.pollInterval !== null) {
      cancelAnimationFrame(this.pollInterval);
      this.pollInterval = null;
    }
    this.connected = false;
    this.axisX = 0;
    this.axisY = 0;
    this.buttonFire = false;
  }

  dispose(): void {
    this.stopPolling();
  }
}
