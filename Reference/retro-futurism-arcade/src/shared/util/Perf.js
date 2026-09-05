/**
 * Adaptive quality governor.
 *
 * Samples a rolling mean of frame time and moves through four quality tiers.
 * The two rules that matter:
 *
 *  1. **Hysteresis.** Stepping down requires a sustained bad average; stepping
 *     back up requires a much better average sustained for three times as long.
 *     Without this the governor oscillates between tiers every second, which is
 *     far more objectionable than simply running one tier lower.
 *
 *  2. **Ordered degradation.** Bloom resolution goes first because it is the
 *     single most expensive pass and halving it is nearly invisible on a
 *     neon-heavy scene. Shadows go last because losing them changes the
 *     lighting read of the whole arena.
 */

export const QUALITY_TIERS = Object.freeze([
  Object.freeze({ name: 'Ultra', bloomDivisor: 2, particleCap: 500, grain: true, shadows: true }),
  Object.freeze({ name: 'High', bloomDivisor: 3, particleCap: 420, grain: true, shadows: true }),
  Object.freeze({ name: 'Medium', bloomDivisor: 4, particleCap: 320, grain: false, shadows: true }),
  Object.freeze({ name: 'Low', bloomDivisor: 4, particleCap: 240, grain: false, shadows: false })
]);

const WINDOW = 60;
const DOWNGRADE_MS = 20.0;
const UPGRADE_MS = 12.0;
const DOWNGRADE_FRAMES = 60;
const UPGRADE_FRAMES = 180;

export class Perf {
  /**
   * @param {(tier:Readonly<object>, index:number) => void} onTierChange
   */
  constructor(onTierChange = null) {
    this.onTierChange = onTierChange;

    /** @type {Float32Array} ring buffer of frame times in milliseconds */
    this.samples = new Float32Array(WINDOW);
    this.sampleIndex = 0;
    this.sampleCount = 0;
    this.sum = 0;

    this.tierIndex = 0;
    this.badFrames = 0;
    this.goodFrames = 0;

    this.fps = 60;
    this.frameMs = 16.6;

    /** Set true to pin the current tier and stop all automatic changes. */
    this.locked = false;

    // Render statistics, refreshed by `sampleRenderer`.
    this.drawCalls = 0;
    this.triangles = 0;
    this.geometries = 0;
    this.textures = 0;
    this.programs = 0;
  }

  /** @returns {Readonly<object>} the active quality tier descriptor */
  get tier() {
    return QUALITY_TIERS[this.tierIndex];
  }

  /**
   * Feed one frame of timing. `dt` is the *unscaled* wall-clock delta in
   * seconds — hit-stop must never be mistaken for a performance problem.
   */
  sample(dt) {
    const ms = dt * 1000;
    this.frameMs = ms;
    this.fps = ms > 0 ? 1000 / ms : 0;

    this.sum -= this.samples[this.sampleIndex];
    this.samples[this.sampleIndex] = ms;
    this.sum += ms;
    this.sampleIndex = (this.sampleIndex + 1) % WINDOW;
    if (this.sampleCount < WINDOW) this.sampleCount++;

    if (this.locked || this.sampleCount < WINDOW) return;

    const mean = this.sum / WINDOW;

    if (mean > DOWNGRADE_MS) {
      this.badFrames++;
      this.goodFrames = 0;
    } else if (mean < UPGRADE_MS) {
      this.goodFrames++;
      this.badFrames = 0;
    } else {
      // Dead band: neither counter advances, so a scene sitting at 15ms simply
      // stays where it is instead of drifting.
      this.badFrames = 0;
      this.goodFrames = 0;
    }

    if (this.badFrames >= DOWNGRADE_FRAMES && this.tierIndex < QUALITY_TIERS.length - 1) {
      this.setTier(this.tierIndex + 1);
    } else if (this.goodFrames >= UPGRADE_FRAMES && this.tierIndex > 0) {
      this.setTier(this.tierIndex - 1);
    }
  }

  /** Force a tier. Also used by the pause menu's manual quality selector. */
  setTier(index) {
    const clamped = Math.max(0, Math.min(QUALITY_TIERS.length - 1, index | 0));
    if (clamped === this.tierIndex) return;
    this.tierIndex = clamped;
    this.badFrames = 0;
    this.goodFrames = 0;
    if (this.onTierChange) this.onTierChange(this.tier, this.tierIndex);
  }

  /** Copy renderer counters for the debug panel. */
  sampleRenderer(renderer) {
    if (!renderer) return;
    const info = renderer.info;
    this.drawCalls = info.render.calls;
    this.triangles = info.render.triangles;
    this.geometries = info.memory.geometries;
    this.textures = info.memory.textures;
    this.programs = info.programs ? info.programs.length : 0;
  }

  /** Rolling mean frame time in milliseconds. */
  get meanFrameMs() {
    return this.sampleCount > 0 ? this.sum / this.sampleCount : 0;
  }

  /** Discard history — called on game mount so the previous title's frame
   *  times cannot trigger a spurious downgrade in the new one. */
  reset() {
    this.samples.fill(0);
    this.sum = 0;
    this.sampleIndex = 0;
    this.sampleCount = 0;
    this.badFrames = 0;
    this.goodFrames = 0;
  }
}
