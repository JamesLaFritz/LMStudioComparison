export const MAX_ACTIVE_PARTICLES = 500;

export const PARTICLE_PRIORITY = Object.freeze({
  AMBIENT: 0,
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4,
});

const ADMISSION_LIMITS = Object.freeze([350, 425, 475, 500, 500]);

function normalizeCount(count) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Particle counter changes must be non-negative integers.');
  return count;
}

function normalizePriority(priority) {
  if (!Number.isInteger(priority) || priority < PARTICLE_PRIORITY.AMBIENT || priority > PARTICLE_PRIORITY.CRITICAL) {
    throw new RangeError('Particle priority must be an integer from 0 through 4.');
  }
  return priority;
}

export class ParticleBudget {
  constructor(capacity = MAX_ACTIVE_PARTICLES) {
    if (!Number.isInteger(capacity) || capacity <= 0 || capacity > MAX_ACTIVE_PARTICLES) {
      throw new RangeError(`Particle capacity must be an integer in [1, ${MAX_ACTIVE_PARTICLES}].`);
    }
    this.capacity = capacity;
    this.reset();
  }

  canAdmit(priority) {
    const normalized = normalizePriority(priority);
    return this.current < Math.min(this.capacity, ADMISSION_LIMITS[normalized]);
  }

  /**
   * Select a free slot or the oldest strictly lower-priority active slot.
   * `activePriorities` uses a negative value (or 255) for inactive records.
   * The input arrays are never modified.
   */
  selectSlot(priority, ages, activePriorities) {
    const normalized = normalizePriority(priority);
    if (!ages || !activePriorities || ages.length < this.capacity || activePriorities.length < this.capacity) {
      throw new RangeError('Particle slot arrays must cover the configured capacity.');
    }

    this.lastSelectionWasPreemption = false;
    let activeCount = 0;
    let firstFree = -1;
    for (let index = 0; index < this.capacity; index += 1) {
      const existingPriority = activePriorities[index];
      if (existingPriority < 0 || existingPriority === 255 || !Number.isFinite(existingPriority)) {
        if (firstFree < 0) firstFree = index;
      } else {
        activeCount += 1;
      }
    }
    this.current = activeCount;

    if (firstFree >= 0) {
      return this.canAdmit(normalized) ? firstFree : -1;
    }

    let candidate = -1;
    let oldestAge = -Infinity;
    for (let index = 0; index < this.capacity; index += 1) {
      if (activePriorities[index] >= normalized) continue;
      const age = Number.isFinite(ages[index]) ? ages[index] : 0;
      if (age > oldestAge) {
        oldestAge = age;
        candidate = index;
      }
    }
    if (candidate >= 0) this.lastSelectionWasPreemption = true;
    return candidate;
  }

  recordRequest(count = 1) {
    this.requested += normalizeCount(count);
  }

  recordEmission(count = 1) {
    const value = normalizeCount(count);
    this.emitted += value;
    this.current = Math.min(this.capacity, this.current + value);
    this.peak = Math.max(this.peak, this.current);
  }

  recordRelease(count = 1) {
    this.current = Math.max(0, this.current - normalizeCount(count));
  }

  recordRejection(count = 1) {
    this.rejected += normalizeCount(count);
  }

  recordPreemption(count = 1) {
    const value = normalizeCount(count);
    this.preempted += value;
    this.emitted += value;
    this.peak = Math.max(this.peak, this.current);
  }

  getStats(target = {}) {
    target.capacity = this.capacity;
    target.current = this.current;
    target.peak = this.peak;
    target.requested = this.requested;
    target.emitted = this.emitted;
    target.rejected = this.rejected;
    target.preempted = this.preempted;
    return target;
  }

  reset() {
    this.current = 0;
    this.peak = 0;
    this.requested = 0;
    this.emitted = 0;
    this.rejected = 0;
    this.preempted = 0;
    this.lastSelectionWasPreemption = false;
  }
}
