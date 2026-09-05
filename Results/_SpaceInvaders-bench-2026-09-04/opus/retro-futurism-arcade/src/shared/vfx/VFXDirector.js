import * as THREE from 'three';
import { CameraShake } from './CameraShake.js';
import { HitStop } from './HitStop.js';
import { ParticleManager } from './ParticleManager.js';
import { ShockwaveSystem } from './Shockwave.js';
import { FloatingTextSystem } from './FloatingText.js';
import { emitRecipe, emitScaled, PRIORITY } from './ParticleEmitters.js';
import { saturate } from '../util/MathUtils.js';

/**
 * The single facade over all six mandatory shared effects.
 *
 * Gameplay code never touches `CameraShake`, `HitStop`, `ParticleManager` or
 * `ShockwaveSystem` directly. It describes *what happened* — a position, a
 * surface normal, and a normalised impact power — and this class decides what
 * that should look and feel like.
 *
 * ### Why route everything through one curve
 *
 * If each call site chose its own trauma value, particle count and freeze
 * duration, the game's feedback language would drift apart within a week of
 * development: one weapon would shake hard and barely spark, another would
 * spark hard and barely shake, and the inconsistency reads to a player as
 * cheapness even though they could not name it. Deriving every channel from a
 * single `power` scalar means an impact twice as strong is twice as strong in
 * *every* channel, automatically, everywhere — and it is what will make all
 * fourteen titles in this arcade feel like one product.
 *
 * ### The channels
 *
 *   power ─┬─> trauma          (camera shake, and thence chromatic aberration)
 *          ├─> particle count  (via emitScaled)
 *          ├─> hit-stop        (gated: routine hits must not stutter the game)
 *          ├─> shockwave radius
 *          └─> dynamic light   (delegated to the game's own light pool)
 *
 * ### The hit-stop gate
 *
 * Hit-stop below `hitStopThreshold` is *suppressed entirely*. This is the most
 * important tuning decision in the class. Freezing on every routine kill in a
 * game with 55 kills per wave produces a permanent stutter that players
 * describe as "laggy" rather than "punchy". Hit-stop must stay rare enough to
 * still mean something.
 */
export class VFXDirector {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {THREE.Camera} opts.camera
   * @param {HTMLElement} opts.overlay DOM root for floating text
   * @param {boolean} [opts.reducedMotion]
   */
  constructor({
    scene,
    camera,
    overlay,
    reducedMotion = false,
    particleCap = 500,
    shockwaveCapacity = 12,
    floatingTextCapacity = 14
  }) {
    this.scene = scene;
    this.camera = camera;
    this.reducedMotion = reducedMotion;

    this.shake = new CameraShake();
    this.hitStop = new HitStop();
    this.particles = new ParticleManager(scene, { cap: particleCap });
    this.shockwaves = new ShockwaveSystem(scene, { capacity: shockwaveCapacity });
    this.text = new FloatingTextSystem({
      container: overlay,
      capacity: floatingTextCapacity
    });

    /**
     * Optional hook so a game can attach its own dynamic-light pool to the
     * same impact events without the director needing to know about lights.
     * @type {((spec:object) => void)|null}
     */
    this.onImpactLight = null;

    /** Impacts below this power never trigger hit-stop. See class comment. */
    this.hitStopThreshold = 0.55;

    /** Global multiplier on every visual channel; used for accessibility. */
    this.intensity = 1;

    if (reducedMotion) this.setReducedMotion(true);

    this._normal = new THREE.Vector3();
    this._color = new THREE.Color();
  }

  /** Current simulation timescale. `Loop` reads this every frame. */
  get timeScale() {
    return this.hitStop.timeScale;
  }

  /** Current camera trauma. `PostFX` reads this to drive chromatic aberration. */
  get trauma() {
    return this.shake.trauma;
  }

  /**
   * The universal impact event.
   *
   * @param {object} spec
   * @param {number} spec.x
   * @param {number} spec.y
   * @param {number} [spec.z]
   * @param {number} [spec.nx] surface normal x — particles spray along it
   * @param {number} [spec.ny] surface normal y
   * @param {number} [spec.power] 0..1 normalised impact energy
   * @param {THREE.ColorRepresentation} [spec.color]
   * @param {THREE.ColorRepresentation} [spec.colorB]
   * @param {string} [spec.recipe] particle recipe name
   * @param {number} [spec.impactSpeed] relative collision speed, world units/s
   * @param {number} [spec.trauma] explicit trauma override
   * @param {number} [spec.hitStop] explicit freeze duration override
   * @param {number} [spec.hitStopPriority]
   * @param {number} [spec.shockwave] explicit final radius; 0 disables
   * @param {number} [spec.particleCount] explicit count override
   * @param {boolean} [spec.light] request a dynamic light flash
   */
  impact(spec) {
    const {
      x,
      y,
      z = 0,
      nx = 0,
      ny = 1,
      power = 0.4,
      color = 0xffffff,
      colorB = null,
      recipe = 'sparks',
      impactSpeed = null,
      trauma = null,
      hitStop = null,
      hitStopPriority = 0,
      shockwave = null,
      particleCount = null,
      light = false
    } = spec;

    const p = saturate(power);
    const scale = this.intensity;

    // --- Camera shake -----------------------------------------------------
    // Trauma rises with the square root of power so that low-power events are
    // still perceptible. Linear mapping makes everything below ~0.3 invisible,
    // which loses the feedback on exactly the events that happen most often.
    const traumaAmount = trauma !== null ? trauma : 0.55 * Math.sqrt(p);
    if (traumaAmount > 0) {
      this.shake.add(traumaAmount * scale, impactSpeed);
    }

    // --- Particles --------------------------------------------------------
    const emitOpts = {
      x,
      y,
      z,
      color,
      dirX: nx,
      dirY: ny,
      dirZ: 0
    };
    if (colorB !== null) emitOpts.colorB = colorB;
    if (particleCount !== null) emitOpts.count = particleCount;

    // A normal of exactly zero means "no surface" — an airburst — so the
    // particles go omnidirectional rather than collapsing onto one axis.
    if (nx === 0 && ny === 0) {
      emitOpts.spread = Math.PI * 2;
      emitOpts.dirY = 1;
    }

    emitScaled(this.particles, recipe, p, emitOpts);

    // --- Shockwave --------------------------------------------------------
    const radius = shockwave !== null ? shockwave : 0.8 + 4.2 * p * p;
    if (radius > 0) {
      this.shockwaves.spawn({
        x,
        y,
        z,
        radius: radius * scale,
        startRadius: Math.min(0.25, radius * 0.12),
        life: 0.35 + 0.4 * p,
        color,
        energy: 1.4 + 1.8 * p
      });
    }

    // --- Hit-stop ---------------------------------------------------------
    if (hitStop !== null) {
      this.hitStop.request(hitStop, hitStopPriority);
    } else if (p >= this.hitStopThreshold) {
      // Above the gate, duration scales with the excess power only — so an
      // event just over the threshold gets a barely-there 20ms and a maximal
      // one gets the full window.
      const excess = (p - this.hitStopThreshold) / (1 - this.hitStopThreshold);
      this.hitStop.request(0.02 + 0.14 * excess, Math.round(p * 10));
    }

    // --- Dynamic light ----------------------------------------------------
    if (light && this.onImpactLight) {
      this.onImpactLight({ x, y, z, color, power: p });
    }
  }

  /**
   * Fire a named particle recipe with no other channels. For continuous
   * emitters (thrusters, engine wash) that must never shake the camera.
   */
  emit(recipeName, opts) {
    return emitRecipe(this.particles, recipeName, opts);
  }

  /** Scaled recipe emission without the rest of the impact package. */
  emitScaled(recipeName, power, opts) {
    return emitScaled(this.particles, recipeName, power, opts);
  }

  /**
   * A shockwave with no particles or shake — used for telegraphs and for
   * non-violent events like a wave clearing.
   */
  ring(spec) {
    return this.shockwaves.spawn(spec);
  }

  /** Add trauma directly. For continuous sources like a descending formation. */
  addTrauma(amount, impactSpeed = null) {
    this.shake.add(amount * this.intensity, impactSpeed);
  }

  /** Request a freeze directly, bypassing the power curve. */
  freeze(duration, priority = 0) {
    return this.hitStop.request(duration, priority);
  }

  /**
   * Spawn a score popup.
   * @param {object} spec
   * @param {number} spec.x @param {number} spec.y @param {number} [spec.z]
   * @param {string} spec.text
   * @param {string} [spec.variant]
   */
  score(spec) {
    return this.text.spawn(spec);
  }

  /**
   * Advance every subsystem with the correct clock.
   *
   * The split is the whole point of the two-timeline design and is easy to get
   * wrong, so it is centralised here rather than left to each game:
   *
   *   scaled   — particles, shockwaves. Freeze with the world.
   *   unscaled — hit-stop itself, camera shake, floating text. Keep running,
   *              which is what makes a freeze frame read as deliberate.
   */
  update(unscaledDt, scaledDt) {
    this.hitStop.update(unscaledDt);
    this.shake.update(unscaledDt);
    this.particles.update(scaledDt);
    this.shockwaves.update(scaledDt);
    this.text.update(unscaledDt, this.camera);
  }

  /** Push the composed shake into a camera rig channel. */
  applyToRig(rig, key = 'shake') {
    this.shake.applyTo(rig, key);
  }

  /** Keep the floating-text projection in sync with the viewport. */
  setViewport(width, height) {
    this.text.setViewport(width, height);
  }

  /** Swap cameras (used when a game changes its rig). */
  setCamera(camera) {
    this.camera = camera;
  }

  /** Apply a quality tier. Only the particle cap is tier-dependent here. */
  setQualityTier(tier) {
    if (tier && typeof tier.particleCap === 'number') {
      this.particles.setCap(tier.particleCap);
    }
  }

  /**
   * Accessibility path.
   *
   * Camera shake and hit-stop are both suppressed — they are precisely the
   * vestibular and timing distortions `prefers-reduced-motion` is asking about.
   * Particles, shockwaves and score text all remain, so the player loses none
   * of the *information* the effects carry, only the motion.
   */
  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
    this.shake.intensityScale = enabled ? 0 : 1;
    this.hitStop.setEnabled(!enabled);
  }

  /** Cut all in-flight effects. Called on pause, restart and state changes. */
  clear() {
    this.shake.reset();
    this.hitStop.clear();
    this.particles.clear();
    this.shockwaves.clear();
    this.text.clear();
  }

  /** Aggregate diagnostics for the debug panel. */
  stats() {
    return {
      particles: this.particles.stats(),
      shockwaves: this.shockwaves.stats(),
      trauma: this.shake.trauma,
      timeScale: this.hitStop.timeScale,
      freezes: this.hitStop.triggerCount
    };
  }

  dispose() {
    this.particles.dispose();
    this.shockwaves.dispose();
    this.text.dispose();
  }
}

export { PRIORITY };
