export class HitStop {
  constructor() {
    this._remaining = 0;
  }

  get isActive() {
    return this._remaining > 0;
  }

  trigger(ms) {
    this._remaining = Math.max(this._remaining, ms);
  }

  update() {
    if (this._remaining > 0) {
      this._remaining -= 16.67;
      if (this._remaining < 0) this._remaining = 0;
    }
  }

  getTimescale() {
    return this.isActive ? 0 : 1;
  }
}
