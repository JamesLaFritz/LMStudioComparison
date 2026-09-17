export const HIT_STOP_PRIORITY = Object.freeze({
  AMBIENT: 0,
  LIGHT: 1,
  HEAVY: 2,
  MAJOR: 3,
  CRITICAL: 4,
});

/** Integer-tick hit-stop arbiter owned by deterministic simulation time. */
export class HitStopController {
  constructor({ maxTicks = 12 } = {}) {
    if (!Number.isInteger(maxTicks) || maxTicks <= 0) {
      throw new RangeError('maxTicks must be a positive integer');
    }
    this._maxTicks = maxTicks;
    this._remainingTicks = 0;
    this._priority = -1;
  }

  get active() {
    return this._remainingTicks > 0;
  }

  get remainingTicks() {
    return this._remainingTicks;
  }

  get priority() {
    return this._priority;
  }

  request(priority, ticks) {
    if (!Number.isInteger(priority) || priority < 0) throw new RangeError('priority must be a non-negative integer');
    if (!Number.isFinite(ticks) || ticks <= 0) return false;
    const requestedTicks = Math.min(this._maxTicks, Math.max(1, Math.ceil(ticks)));

    if (!this.active || priority > this._priority) {
      this._priority = priority;
      this._remainingTicks = requestedTicks;
      return true;
    }
    if (priority === this._priority && requestedTicks > this._remainingTicks) {
      this._remainingTicks = requestedTicks;
      return true;
    }
    return false;
  }

  consumeTick() {
    if (!this.active) return false;
    this._remainingTicks -= 1;
    if (this._remainingTicks === 0) this._priority = -1;
    return true;
  }

  reset() {
    this._remainingTicks = 0;
    this._priority = -1;
  }
}
