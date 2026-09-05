import { clamp, smoothstep } from '../util/MathUtils.js';

/**
 * MANDATORY SHARED VFX #3 — Hit-stop / frame-freeze.
 *
 * Briefly collapses the simulation timescale on heavy impacts. The effect is
 * borrowed from fighting games, where it does something no amount of particle
 * work can: it makes a hit feel like it has *mass*, by stealing time from the
 * player at the exact moment of contact.
 *
 * ### Requests do not stack
 *
 * This is the single most important design decision in the class. If two
 * simultaneous impacts each request 0.1s and those durations add, a busy moment
 * produces half a second of slow motion and the game feels broken. Instead the
 * strongest request wins: higher priority always takes over, and an equal
 * priority only extends if it is genuinely longer. The result is that hit-stop
 * duration is bounded by the largest single event, no matter how many events
 * coincide.
 *
 * ### Eased release, not a step
 *
 * Snapping from 0.06x back to 1.0x reads as a dropped frame. Holding the freeze
 * for the first part of the window and then easing out over the remainder
 * returns the world's momentum smoothly, so the freeze reads as deliberate.
 *
 * ### What must NOT be scaled
 *
 * Camera shake, UI animation, film grain and the performance governor all run
 * on the unscaled clock. A freeze frame where *everything* stops is
 * indistinguishable from a hang; the contrast between a frozen world and a
 * still-convulsing camera is the entire effect.
 */
export class HitStop {
  /**
   * @param {object} [opts]
   * @param {number} [opts.freezeScale]   timescale during the hold phase
   * @param {number} [opts.releaseRatio]  fraction of the duration spent easing out
   */
  constructor(opts = {}) {
    const { freezeScale = 0.06, releaseRatio = 0.55, maxDuration = 0.4 } = opts;

    this.freezeScale = freezeScale;
    this.releaseRatio = releaseRatio;
    this.maxDuration = maxDuration;

    this.duration = 0;
    this.remaining = 0;
    this.priority = -1;

    /** Current timescale. Read by `Loop` every frame. */
    this.timeScale = 1;

    /** Set false by the reduced-motion path; requests become no-ops. */
    this.enabled = true;

    /** Diagnostics. */
    this.triggerCount = 0;
  }

  /** True while a freeze is in progress. */
  get active() {
    return this.remaining > 0;
  }

  /**
   * Request a freeze.
   *
   * @param {number} duration seconds
   * @param {number} [priority] higher pre-empts lower
   * @returns {boolean} whether the request took effect
   */
  request(duration, priority = 0) {
    if (!this.enabled || duration <= 0) return false;

    const d = clamp(duration, 0, this.maxDuration);

    // Higher priority always wins. Equal priority only wins if it would
    // genuinely last longer than what is already running — otherwise a stream
    // of small identical hits would keep restarting the freeze and hold the
    // game in slow motion indefinitely.
    const wins = priority > this.priority || (priority === this.priority && d > this.remaining);
    if (!wins) return false;

    this.duration = d;
    this.remaining = d;
    this.priority = priority;
    this.triggerCount++;
    return true;
  }

  /**
   * Advance the freeze and recompute the timescale.
   * @param {number} unscaledDt real seconds
   */
  update(unscaledDt) {
    if (this.remaining <= 0) {
      this.timeScale = 1;
      this.priority = -1;
      return;
    }

    this.remaining = Math.max(0, this.remaining - unscaledDt);

    const elapsed = this.duration - this.remaining;
    const holdTime = this.duration * (1 - this.releaseRatio);

    if (elapsed < holdTime) {
      // Hold phase: hard freeze.
      this.timeScale = this.freezeScale;
    } else {
      // Release phase: ease back to full speed.
      const releaseSpan = this.duration - holdTime;
      const t = releaseSpan > 0 ? (elapsed - holdTime) / releaseSpan : 1;
      this.timeScale = this.freezeScale + (1 - this.freezeScale) * smoothstep(0, 1, t);
    }

    if (this.remaining <= 0) {
      this.timeScale = 1;
      this.priority = -1;
    }
  }

  /** Cancel any active freeze immediately. Used on pause and state changes. */
  clear() {
    this.remaining = 0;
    this.duration = 0;
    this.priority = -1;
    this.timeScale = 1;
  }

  /**
   * Accessibility path. Hit-stop is a timing distortion and is disabled under
   * `prefers-reduced-motion`; any in-flight freeze is cancelled so the setting
   * takes effect immediately rather than after the current one drains.
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }
}
