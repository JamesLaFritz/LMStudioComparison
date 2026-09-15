import * as THREE from 'three';

export class GameLoop {
  constructor(updateFn, renderFn) {
    this._update = updateFn;
    this._render = renderFn;
    this._running = false;
    this._lastTime = 0;
    this._timescale = 1.0;
    this._rafId = null;
  }

  setTimescale(t) {
    this._timescale = Math.max(0, t);
  }

  get timescale() {
    return this._timescale;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._tick();
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick() {
    if (!this._running) return;
    const now = performance.now();
    let rawDt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    // Clamp dt to prevent physics explosions on tab-switch
    rawDt = Math.min(rawDt, 0.1);
    rawDt = Math.max(rawDt, 0.0001);
    const dt = rawDt * this._timescale;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame(() => this._tick());
  }
}
