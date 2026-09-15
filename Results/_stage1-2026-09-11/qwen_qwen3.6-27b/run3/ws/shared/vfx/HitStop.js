export class HitStop {
  constructor() {
    this.active = false;
    this.timer = 0;
  }

  trigger(duration) {
    if (this.active) {
      if (duration > this.timer) {
        this.timer = duration;
      }
      return;
    }
    this.active = true;
    this.timer = duration;
  }

  update(dt) {
    if (!this.active) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.active = false;
      this.timer = 0;
    }
  }
}
