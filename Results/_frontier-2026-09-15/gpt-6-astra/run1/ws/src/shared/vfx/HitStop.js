import { clamp } from "../core/math.js";
export class HitStop {
  constructor({ maxDuration = 0.1, rechargeRate = 0.3 } = {}) {
    this.maxDuration = maxDuration;
    this.rechargeRate = rechargeRate;
    this.remaining = 0;
    this.credit = maxDuration;
    this.priority = -1;
  }
  get active() {
    return this.remaining > 1e-8;
  }
  request(duration, priority = 1) {
    if (this.active && priority < this.priority) return;
    const extra = Math.min(
      this.credit,
      Math.max(0, clamp(duration, 0, this.maxDuration) - this.remaining),
    );
    this.remaining += extra;
    this.credit -= extra;
    this.priority = Math.max(priority, this.priority);
  }
  consume(dt) {
    this.credit = Math.min(
      this.maxDuration,
      this.credit + dt * this.rechargeRate,
    );
    const frozen = Math.min(dt, this.remaining);
    this.remaining -= frozen;
    if (!this.active) {
      this.remaining = 0;
      this.priority = -1;
    }
    return dt - frozen;
  }
  clear() {
    this.remaining = 0;
    this.priority = -1;
    this.credit = this.maxDuration;
  }
}
