/**
 * HitStop - Frame freeze / timescale dilation on heavy impacts.
 * Maintains a global timescale that can be pulsed to 0.15 for ~60ms
 * on significant events (invader kills, player death).
 */

export class HitStop {
  constructor() {
    this.timescale = 1.0;
    this.targetTimescale = 1.0;
    this.currentDuration = 0;
    this.maxDuration = 0;
    this.isTriggered = false;
    this.rampSpeed = 8.0; // How fast timescale returns to 1.0
  }

  trigger(durationMs, minTimescale = 0.15) {
    this.timescale = minTimescale;
    this.targetTimescale = 1.0;
    this.currentDuration = durationMs / 1000;
    this.maxDuration = this.currentDuration;
    this.isTriggered = true;
  }

  update(deltaTime) {
    if (!this.isTriggered) return;

    this.currentDuration -= deltaTime;

    if (this.currentDuration <= 0) {
      // Ramp back to normal timescale
      this.timescale += this.rampSpeed * deltaTime;
      if (this.timescale >= 1.0) {
        this.timescale = 1.0;
        this.isTriggered = false;
      }
    }

    this.targetTimescale = this.currentDuration > 0 ? 0.15 : 1.0;
    if (this.currentDuration > 0) {
      this.timescale = 0.15;
    }
  }

  getEffectiveDelta(baseDelta) {
    return baseDelta * this.timescale;
  }

  reset() {
    this.timescale = 1.0;
    this.targetTimescale = 1.0;
    this.currentDuration = 0;
    this.maxDuration = 0;
    this.isTriggered = false;
  }
}
