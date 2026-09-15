import { clamp } from '../math/MathUtils.js';

export class CameraShake {
  constructor() {
    this._trauma = 0;
    this._offsetX = 0;
    this._offsetY = 0;
    this._offsetZ = 0;
  }

  addTrauma(amount) {
    this._trauma = Math.min(this._trauma + amount, 5.0);
  }

  update(dt, camera) {
    if (this._trauma < 0.001) {
      this._trauma = 0;
      this._offsetX = 0;
      this._offsetY = 0;
      this._offsetZ = 0;
      return;
    }
    const decay = 1 - 5.5 * dt;
    this._trauma *= Math.max(decay, 0);
    const spread = this._trauma * 0.4;
    this._offsetX = (Math.random() - 0.5) * 2 * spread;
    this._offsetY = (Math.random() - 0.5) * 2 * spread;
    this._offsetZ = (Math.random() - 0.5) * spread * 0.3;
    camera.position.x += this._offsetX;
    camera.position.y += this._offsetY;
    camera.position.z += this._offsetZ;
  }

  getIntensity() {
    return this._trauma;
  }

  reset() {
    this._trauma = 0;
    this._offsetX = 0;
    this._offsetY = 0;
    this._offsetZ = 0;
  }
}
