/**
 * Rendering can use HitStop to gate simulation deltas without ever inventing a
 * partial game tick. Higher-priority requests replace weaker freezes.
 */
export class HitStop {
  constructor() {
    this.remaining = 0;
    this.priority = -Infinity;
  }

  request(duration = 0, priority = 0) {
    const safeDuration = Math.max(0, duration || 0);
    if (priority >= this.priority || safeDuration > this.remaining) {
      this.remaining = Math.max(this.remaining, safeDuration);
      this.priority = priority;
    }
  }

  update(realDelta) {
    if (this.remaining <= 0) return false;
    this.remaining = Math.max(0, this.remaining - Math.max(0, realDelta || 0));
    if (this.remaining === 0) this.priority = -Infinity;
    return this.remaining > 0;
  }

  get active() {
    return this.remaining > 0;
  }

  simulationDelta(delta) {
    return this.active ? 0 : delta;
  }

  reset() {
    this.remaining = 0;
    this.priority = -Infinity;
  }
}
