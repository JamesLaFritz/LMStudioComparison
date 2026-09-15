export class HitStop {
  constructor() {
    this.remainingTime = 0;
    this.active = false;
  }

  trigger(duration) {
    if (duration > this.remainingTime) {
      this.remainingTime = duration;
    }
    this.active = true;
  }

  getTimescale() {
    return this.active ? 0 : 1;
  }

  update(deltaTime) {
    if (!this.active) return;
    this.remainingTime -= deltaTime;
    if (this.remainingTime <= 0) {
      this.remainingTime = 0;
      this.active = false;
    }
  }
}
