import * as THREE from 'three';
import { SimplexNoise } from '../procgen/SimplexNoise.js';
import { clamp } from '../util/MathUtils.js';

/**
 * MANDATORY SHARED VFX #1 — Trauma-based camera shake.
 *
 * Implements the trauma model rather than a decaying-impulse model.
 *
 * The distinction matters. An impulse model ("add 0.3 to shake, multiply by
 * 0.9 each frame") has two failure modes that are immediately visible: several
 * impacts in one frame stack into an uncontrolled spike, and the decay rate is
 * frame-rate dependent. The trauma model fixes both. A single scalar `trauma`
 * is clamped to [0,1] no matter how many events land, and it decays linearly
 * in *seconds*, so the shake lasts the same wall-clock time on any machine.
 *
 * Three properties do the actual work:
 *
 *  1. **`shake = trauma²`.** The squaring is the whole feel of the system.
 *     A small hit at trauma 0.2 produces shake 0.04 — a barely perceptible
 *     tick. A death at trauma 0.9 produces 0.81 — twenty times as violent for
 *     four and a half times the input. Linear trauma makes small hits too
 *     noisy and big hits too weak; there is no linear curve that serves both.
 *
 *  2. **Perlin/simplex noise, not random.** Uncorrelated random offsets make
 *     consecutive frames unrelated, which the eye reads as strobing or as
 *     dropped frames. Sampling a coherent noise field along a time axis
 *     produces a continuous path — the camera *travels* rather than teleports,
 *     which is what a physically struck camera does.
 *
 *  3. **Decoupled axes.** X, Y and roll sample the same field at different
 *     channel offsets, so they are individually smooth but mutually
 *     uncorrelated. Sharing one signal across axes produces diagonal shake
 *     that reads as a wobble.
 *
 * Driven by the **unscaled** clock, deliberately. During hit-stop the world
 * freezes and the camera keeps convulsing; that contrast is most of what makes
 * a freeze frame land.
 */
export class CameraShake {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxOffset]     peak positional displacement, world units
   * @param {number} [opts.maxRoll]       peak roll, radians
   * @param {number} [opts.decay]         trauma lost per second
   * @param {number} [opts.frequency]     noise sampling rate along the time axis
   * @param {number} [opts.referenceSpeed] impact speed that maps to a 1.0 scale
   */
  constructor(opts = {}) {
    const {
      maxOffset = 0.62,
      maxRoll = 0.055,
      decay = 1.4,
      frequency = 22,
      rollFrequency = 17,
      referenceSpeed = 22,
      seed = 0x5eed
    } = opts;

    this.maxOffset = maxOffset;
    this.maxRoll = maxRoll;
    this.decay = decay;
    this.frequency = frequency;
    this.rollFrequency = rollFrequency;
    this.referenceSpeed = referenceSpeed;

    this.noise = new SimplexNoise(seed);

    /** Current trauma, 0..1. Read by PostFX to drive chromatic aberration. */
    this.trauma = 0;
    this.time = 0;

    /** Composed output, read by CameraRig each frame. */
    this.offset = new THREE.Vector3();
    this.roll = 0;

    /**
     * Global scale on all output. The reduced-motion path sets this to 0 and
     * substitutes a vignette flash; it is a multiplier rather than a branch so
     * that trauma still accumulates and still drives the substitute effect.
     */
    this.intensityScale = 1;
  }

  /**
   * Add trauma from an impact.
   *
   * @param {number} amount base trauma for this event type
   * @param {number} [impactSpeed] relative speed of the collision, world units/sec
   *
   * Velocity scaling is clamped to [0.5, 2]. Unclamped, a grazing collision
   * would produce no feedback at all and a fast one would saturate instantly —
   * the clamp keeps every event legible while still letting speed matter.
   */
  add(amount, impactSpeed = null) {
    let scale = 1;
    if (impactSpeed !== null && this.referenceSpeed > 0) {
      scale = clamp(impactSpeed / this.referenceSpeed, 0.5, 2);
    }
    this.trauma = clamp(this.trauma + amount * scale, 0, 1);
  }

  /** Force trauma to an exact value. Used by scripted sequences. */
  setTrauma(value) {
    this.trauma = clamp(value, 0, 1);
  }

  /**
   * Advance the shake.
   * @param {number} unscaledDt real seconds, never the dilated delta
   */
  update(unscaledDt) {
    this.time += unscaledDt;

    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.decay * unscaledDt);
    }

    // Quadratic response — see class comment.
    const shake = this.trauma * this.trauma * this.intensityScale;

    if (shake <= 0) {
      this.offset.set(0, 0, 0);
      this.roll = 0;
      return;
    }

    const t = this.time * this.frequency;
    const rt = this.time * this.rollFrequency;

    this.offset.set(
      this.maxOffset * shake * this.noise.noise1D(t, 0),
      this.maxOffset * shake * this.noise.noise1D(t, 1),
      // Z is deliberately shallower. Full-strength shake along the view axis
      // reads as a zoom pulse rather than a jolt, and it fights the tension
      // dolly for control of the same channel.
      this.maxOffset * shake * 0.35 * this.noise.noise1D(t, 2)
    );

    this.roll = this.maxRoll * shake * this.noise.noise1D(rt, 3);
  }

  /**
   * Wire this shake into a CameraRig under a named channel. Keeping the rig
   * responsible for composition means shake can never fight the dolly or the
   * parallax for ownership of `camera.position`.
   *
   * @param {import('../render/CameraRig.js').CameraRig} rig
   * @param {string} [key]
   */
  applyTo(rig, key = 'shake') {
    rig.setOffset(key, this.offset.x, this.offset.y, this.offset.z);
    rig.setRoll(key, this.roll);
  }

  /** Cut all shake immediately. Used on state transitions and on pause. */
  reset() {
    this.trauma = 0;
    this.offset.set(0, 0, 0);
    this.roll = 0;
  }
}
