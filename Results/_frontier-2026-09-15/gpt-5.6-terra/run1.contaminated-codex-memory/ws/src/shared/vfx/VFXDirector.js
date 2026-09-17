import { CameraShake } from './CameraShake.js';
import { FloatingScoreSystem } from './FloatingScoreSystem.js';
import { HitStop } from './HitStop.js';
import { PARTICLE_HARD_CAP, ParticleManager } from './ParticleManager.js';
import { impactPriority, particleRecipeFor } from './ParticleRecipes.js';
import { ShockwaveSystem } from './ShockwaveSystem.js';
import { TrailBatch } from './TrailBatch.js';

/**
 * Semantic bridge from simulation events to bounded render-side effects. It
 * never writes simulation state, score, position, or collision information.
 */
export class VFXDirector {
  constructor({
    scene,
    camera = null,
    cameraRig = null,
    container = null,
    overlay = null,
    registry = null,
    maxParticles = PARTICLE_HARD_CAP,
    projectileTracks = 10,
  } = {}) {
    this.registry = registry;
    this.camera = camera;
    this.cameraRig = cameraRig;
    this.particles = new ParticleManager({ scene, registry, maxParticles });
    this.shockwaves = new ShockwaveSystem({ scene, registry, capacity: 12 });
    this.trails = new TrailBatch({ scene, registry, tracks: projectileTracks, samples: 16 });
    this.floatingScores = new FloatingScoreSystem({
      container: container ?? overlay,
      camera,
      registry,
      capacity: 16,
    });
    this.shake = new CameraShake();
    this.hitStop = new HitStop();
    this.eventCounts = Object.create(null);
    this.disposed = false;
  }

  consume(event = {}) {
    if (this.disposed || !event.type) return;
    this.eventCounts[event.type] = (this.eventCounts[event.type] ?? 0) + 1;
    const recipe = particleRecipeFor(event);
    if (recipe) this.particles.spawnBurst(recipe);

    const priority = impactPriority(event);
    switch (event.type) {
      case 'invader-hit':
        this._impact(event, { startRadius: 0.14, endRadius: 0.78, life: 0.28, priority, shake: 0.08 });
        this._score(event, priority);
        break;
      case 'bunker-hit':
        this._impact(event, { startRadius: 0.06, endRadius: 0.28, life: 0.18, priority, shake: 0.025 });
        break;
      case 'ufo-hit':
        this._impact(event, { startRadius: 0.28, endRadius: 1.65, life: 0.5, priority, shake: 0.22, stop: 0.04 });
        this._score(event, priority);
        break;
      case 'player-hit':
        this._impact(event, { startRadius: 0.38, endRadius: 2.1, life: 0.68, priority, shake: 0.54, stop: 0.12 });
        break;
      case 'wave-clear':
        this._impact(event, { startRadius: 0.38, endRadius: 2.8, life: 0.76, priority, shake: 0.18, stop: 0.025 });
        break;
      case 'victory':
        this._impact(event, { startRadius: 0.45, endRadius: 4.4, life: 1.05, priority: 100, shake: 0.36, stop: 0.085 });
        break;
      case 'formation-step':
        this.shake.trigger(0.009, 1);
        break;
      default:
        break;
    }
  }

  update(realDelta, simulationDelta = realDelta) {
    if (this.disposed) return;
    const frozen = this.hitStop.active;
    this.hitStop.update(realDelta);
    const visualDelta = frozen ? 0 : Math.max(0, simulationDelta || 0);
    this.particles.update(visualDelta);
    this.shockwaves.update(visualDelta);
    if (!frozen) this.trails.update();
    this.shake.update(realDelta);
    this.floatingScores.update(realDelta);
    this.applyCameraRig();
  }

  applyCameraRig(cameraRig = this.cameraRig) {
    this.shake.apply(cameraRig);
  }

  setViewport(width, height) {
    this.floatingScores.setViewport(width, height);
  }

  setCamera(camera) {
    this.camera = camera;
    this.floatingScores.setCamera(camera);
  }

  setProjectileHead(slot, x, y, z = 0, active = true) {
    this.trails.setHead(this._trailSlot(slot), x, y, z, active);
  }

  clearProjectileTrail(slot) {
    this.trails.clearTrack(this._trailSlot(slot));
  }

  getSimulationDelta(delta) {
    return this.hitStop.simulationDelta(delta);
  }

  stats() {
    return {
      particles: this.particles.stats(),
      shockwaves: this.shockwaves.stats(),
      trails: this.trails.stats(),
      floatingScores: this.floatingScores.stats(),
      hitStopRemaining: this.hitStop.remaining,
      cameraTrauma: this.shake.trauma,
      events: { ...this.eventCounts },
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._releaseRenderPool(this.particles);
    this._releaseRenderPool(this.shockwaves);
    this._releaseRenderPool(this.trails);
    for (const node of this.floatingScores.nodes) this.registry?.untrack(node);
    this.floatingScores.dispose();
    this.hitStop.reset();
    this.shake.reset();
  }

  _impact(event, { startRadius, endRadius, life, priority, shake, stop = 0 }) {
    this.shockwaves.spawn({
      x: Number(event.x) || 0,
      y: Number(event.y) || 0,
      z: Number(event.z) || 0,
      startRadius,
      endRadius,
      life,
      priority,
      color: event.type === 'ufo-hit' ? 0xffcd64 : event.type === 'player-hit' ? 0x66f6ff : 0xee78df,
    });
    this.shake.trigger(shake, Number(event.velocity) || 18);
    if (stop > 0) this.hitStop.request(stop, priority);
  }

  _score(event, priority) {
    if (!Number.isFinite(event.score) || event.score <= 0) return;
    this.floatingScores.spawn({
      x: Number(event.x) || 0,
      y: Number(event.y) || 0,
      z: Number(event.z) || 0,
      text: '+' + event.score,
      color: event.type === 'ufo-hit' ? '#ffe27c' : '#ff9ae8',
      priority,
    });
  }

  _releaseRenderPool(pool) {
    this.registry?.untrack(pool.mesh);
    this.registry?.untrack(pool.geometry);
    this.registry?.untrack(pool.material);
    pool.dispose();
  }

  _trailSlot(slot) {
    // ProjectileRenderer reserves slots 4 and 5 while it indexes enemy bolts
    // from 6 through 11. Compact that layout into the planned ten trail tracks.
    return slot >= this.trails.tracks && slot >= 6 ? slot - 2 : slot;
  }
}
