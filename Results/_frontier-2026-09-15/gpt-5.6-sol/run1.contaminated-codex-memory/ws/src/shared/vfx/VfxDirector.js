import * as THREE from 'three';
import { ParticleManager } from './ParticleManager.js';
import { CameraShake } from './CameraShake.js';
import { MotionTrailManager } from './MotionTrailManager.js';
import { ShockwaveManager } from './ShockwaveManager.js';
import { FloatingScoreManager } from './FloatingScoreManager.js';

const IMPACT_LIGHT_CAPACITY = 4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class VfxDirector {
  constructor({ scene, camera, overlayRoot, tracker = null, rng = null, reducedMotion = false }) {
    if (!scene?.isScene) throw new TypeError('VfxDirector requires a Scene.');
    if (!camera?.isCamera) throw new TypeError('VfxDirector requires a Camera.');
    this.scene = scene;
    this.camera = camera;
    this.overlayRoot = overlayRoot;
    this.tracker = tracker;
    this.rng = rng;
    this.reducedMotion = Boolean(reducedMotion);
    this.disposed = false;

    this.particles = new ParticleManager({ scene, tracker, rng: rng?.fork?.('particles') ?? rng });
    this.trails = new MotionTrailManager({ scene, tracker, pbr: this.particles.pbr });
    this.shockwaves = new ShockwaveManager({ scene, tracker, pbr: this.particles.pbr });
    this.scores = new FloatingScoreManager({ overlayRoot, camera, poolSize: 32 });
    this.cameraShake = new CameraShake({ rng: rng?.fork?.('camera-shake') ?? rng });

    this.lightActive = new Uint8Array(IMPACT_LIGHT_CAPACITY);
    this.lightPriority = new Uint8Array(IMPACT_LIGHT_CAPACITY);
    this.lightAge = new Float32Array(IMPACT_LIGHT_CAPACITY);
    this.lightLife = new Float32Array(IMPACT_LIGHT_CAPACITY);
    this.lightPeak = new Float32Array(IMPACT_LIGHT_CAPACITY);
    this.lightSequence = new Float64Array(IMPACT_LIGHT_CAPACITY);
    this.nextLightSequence = 1;
    this.lights = new Array(IMPACT_LIGHT_CAPACITY);
    for (let index = 0; index < IMPACT_LIGHT_CAPACITY; index += 1) {
      const light = new THREE.PointLight(0xffffff, 0, 4.5, 2);
      light.name = `pooled-impact-light-${index}`;
      light.visible = false;
      light.castShadow = false;
      scene.add(light);
      tracker?.track(light);
      this.lights[index] = light;
    }
    this.viewport = { left: 0, top: 0, width: 1, height: 1 };
  }

  advance(realDelta) {
    this.#assertUsable();
    const dt = clamp(Number.isFinite(realDelta) ? realDelta : 0, 0, 0.1);
    this.particles.advance(dt);
    this.trails.advance(dt);
    this.shockwaves.advance(dt);
    this.cameraShake.advance(dt, this.reducedMotion);
    this.cameraShake.apply(this.camera);
    this.#advanceLights(dt);
    this.#updateViewport();
    this.scores.advance(dt, this.viewport);
  }

  emitBurst(spec = {}) {
    this.#assertUsable();
    if (!this.reducedMotion) return this.particles.emitBurst(spec);
    const scaledCount = Math.max(spec.priority >= 3 ? 4 : 1, Math.ceil((spec.count ?? 1) * 0.35));
    return this.particles.emitBurst({ ...spec, count: scaledCount, speed: (spec.speed ?? 4.2) * 0.65 });
  }

  emitShockwave(spec = {}) {
    this.#assertUsable();
    if (!this.reducedMotion) return this.shockwaves.emit(spec);
    return this.shockwaves.emit({
      ...spec,
      rMax: (spec.rMax ?? 1.5) * 0.55,
      life: (spec.life ?? 0.42) * 0.7,
    });
  }

  emitScore(spec = {}) {
    this.#assertUsable();
    return this.scores.emit(spec);
  }

  emitImpactLight(spec = {}) {
    this.#assertUsable();
    const priority = clamp(Math.trunc(spec.priority ?? 2), 0, 4);
    const slot = this.#selectLightSlot(priority);
    if (slot < 0) return false;
    const light = this.lights[slot];
    this.lightActive[slot] = 1;
    this.lightPriority[slot] = priority;
    this.lightAge[slot] = 0;
    this.lightLife[slot] = clamp(spec.life ?? 0.11, 0.025, 0.5);
    this.lightPeak[slot] = Math.max(0, spec.intensity ?? 18);
    this.lightSequence[slot] = this.nextLightSequence++;
    light.color.set(spec.color ?? 0x35e8ff);
    light.position.set(Number(spec.x) || 0, Number(spec.y) || 0, Number(spec.z) || 1.2);
    light.distance = Math.max(0.1, spec.distance ?? 4.5);
    light.decay = 2;
    light.intensity = this.lightPeak[slot];
    light.visible = true;
    return true;
  }

  addTrauma(spec = {}) {
    this.#assertUsable();
    return this.cameraShake.addTrauma(spec);
  }

  sampleTrail(projectile) {
    this.#assertUsable();
    if (!projectile || projectile.active === false) return false;
    return this.trails.sample({
      ...projectile,
      minimumDistance: this.reducedMotion
        ? Math.max(projectile.minimumDistance ?? 0.08, 0.18)
        : projectile.minimumDistance,
      life: this.reducedMotion ? Math.min(projectile.life ?? 0.12, 0.075) : projectile.life,
    });
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);
  }

  markGpuDataDirty() {
    this.particles.markGpuDataDirty();
    this.trails.markGpuDataDirty();
    this.shockwaves.markGpuDataDirty();
  }

  getStats(target = {}) {
    target.particles = this.particles.getStats(target.particles ?? {});
    target.trails = this.trails.getStats(target.trails ?? {});
    target.shockwaves = this.shockwaves.getStats(target.shockwaves ?? {});
    target.scores = this.scores.getStats(target.scores ?? {});
    let activeLights = 0;
    for (const active of this.lightActive) activeLights += active;
    target.impactLights = activeLights;
    target.cameraTrauma = this.cameraShake.trauma;
    return target;
  }

  reset() {
    if (this.disposed) return;
    this.cameraShake.restore(this.camera);
    this.cameraShake.reset();
    this.particles.reset();
    this.trails.reset();
    this.shockwaves.reset();
    this.scores.reset();
    this.lightActive.fill(0);
    for (const light of this.lights) {
      light.intensity = 0;
      light.visible = false;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.reset();
    this.particles.detach();
    this.trails.detach();
    this.shockwaves.detach();
    this.scores.dispose();
    this.particles.pbr.disposeReferences();
    for (const light of this.lights) light.removeFromParent();
    this.lights.length = 0;
    this.scene = null;
    this.camera = null;
    this.overlayRoot = null;
    this.particles = null;
    this.trails = null;
    this.shockwaves = null;
    this.scores = null;
    this.disposed = true;
  }

  #advanceLights(dt) {
    // Only the two strongest admitted lights remain visible, avoiding additive washout.
    let strongest = -1;
    let second = -1;
    let strongestValue = -1;
    let secondValue = -1;
    for (let index = 0; index < IMPACT_LIGHT_CAPACITY; index += 1) {
      if (!this.lightActive[index]) continue;
      this.lightAge[index] += dt;
      if (this.lightAge[index] >= this.lightLife[index]) {
        this.lightActive[index] = 0;
        this.lights[index].visible = false;
        this.lights[index].intensity = 0;
        continue;
      }
      const u = this.lightAge[index] / this.lightLife[index];
      const value = this.lightPeak[index] * (1 - u) ** 2;
      this.lights[index].intensity = value;
      if (value > strongestValue) {
        second = strongest;
        secondValue = strongestValue;
        strongest = index;
        strongestValue = value;
      } else if (value > secondValue) {
        second = index;
        secondValue = value;
      }
    }
    for (let index = 0; index < IMPACT_LIGHT_CAPACITY; index += 1) {
      this.lights[index].visible = this.lightActive[index] === 1 && (index === strongest || index === second);
    }
  }

  #selectLightSlot(priority) {
    for (let index = 0; index < IMPACT_LIGHT_CAPACITY; index += 1) {
      if (!this.lightActive[index]) return index;
    }
    let candidate = -1;
    let oldest = Infinity;
    for (let index = 0; index < IMPACT_LIGHT_CAPACITY; index += 1) {
      if (this.lightPriority[index] >= priority) continue;
      if (this.lightSequence[index] < oldest) {
        oldest = this.lightSequence[index];
        candidate = index;
      }
    }
    return candidate;
  }

  #updateViewport() {
    const rect = this.overlayRoot.getBoundingClientRect();
    this.viewport.left = rect.left;
    this.viewport.top = rect.top;
    this.viewport.width = Math.max(1, rect.width);
    this.viewport.height = Math.max(1, rect.height);
  }

  #assertUsable() {
    if (this.disposed) throw new Error('VfxDirector is disposed.');
  }
}
