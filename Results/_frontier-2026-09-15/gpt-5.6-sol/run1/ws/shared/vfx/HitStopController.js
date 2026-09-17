import { clamp, smoothstep } from '../math/MathUtils.js';

export class HitStopController {
  constructor() {
    this.remaining = 0;
    this.duration = 0;
    this.minimumScale = 0;
    this.priority = -1;
    this.admissionCooldown = 0;
    this.enabled = true;
  }

  request(duration, minimumScale = 0, priority = 1) {
    if (!this.enabled || duration <= 0) return false;
    const cappedDuration = Math.min(0.125, duration);
    if (priority <= 2 && this.admissionCooldown > 0) return false;
    if (this.remaining > 0 && priority < this.priority) return false;

    if (priority > this.priority || this.remaining <= 0) {
      this.priority = priority;
      this.minimumScale = clamp(minimumScale, 0, 1);
      this.duration = cappedDuration;
      this.remaining = Math.max(this.remaining, cappedDuration);
    } else {
      this.duration = Math.max(this.duration, cappedDuration);
      this.remaining = Math.max(this.remaining, cappedDuration);
      this.minimumScale = Math.min(this.minimumScale, clamp(minimumScale, 0, 1));
    }
    if (priority <= 2) this.admissionCooldown = 0.045;
    return true;
  }

  consume(realDt) {
    this.admissionCooldown = Math.max(0, this.admissionCooldown - realDt);
    if (!this.enabled || this.remaining <= 0) return realDt;
    this.remaining = Math.max(0, this.remaining - realDt);
    const progress = this.duration <= 0 ? 1 : 1 - this.remaining / this.duration;
    const scale = progress < 0.6
      ? this.minimumScale
      : this.minimumScale + (1 - this.minimumScale) * smoothstep(0.6, 1, progress);
    if (this.remaining === 0) {
      this.priority = -1;
      this.duration = 0;
      this.minimumScale = 0;
    }
    return realDt * scale;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.reset();
  }

  reset() {
    this.remaining = 0;
    this.duration = 0;
    this.minimumScale = 0;
    this.priority = -1;
    this.admissionCooldown = 0;
  }
}
