import * as THREE from 'three';
import { randRange } from '../math/MathUtils.js';

/**
 * Centralized particle system with a HARD cap (default 500 live particles).
 * One InstancedMesh + one CPU struct pool. All games route bursts through here,
 * so the budget is enforced globally, not per-system.
 *
 * Presets: 'sparks' | 'explosion' | 'thruster' | 'debris' | 'ring' (see PRESETS).
 * Particles are pure emissive (black base color) so they read as light and feed
 * the bloom pass without washing out.
 */

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

const PRESETS = {
  sparks:    { count: [10, 18], speed: [3.5, 9.0], life: [0.25, 0.6], size: [0.05, 0.12], gravity: -4.0, colors: ['#7df9ff', '#ffffff', '#ffd166'] },
  explosion: { count: [26, 40], speed: [1.5, 8.5], life: [0.4, 1.1], size: [0.08, 0.26], gravity: -2.0, colors: ['#ff9e3d', '#ff4d6d', '#ffd166', '#ffffff'] },
  thruster:  { count: [2, 4],   speed: [1.5, 3.5], life: [0.15, 0.35], size: [0.04, 0.09], gravity: 0.0, colors: ['#7df9ff', '#b18cff'] },
  debris:    { count: [6, 12],  speed: [2.0, 6.0], life: [0.5, 1.2], size: [0.06, 0.16], gravity: -9.0, colors: ['#8a93b2', '#c7d2fe'] },
};

export class ParticleManager {
  constructor(scene, { cap = 500 } = {}) {
    this.scene = scene;
    this.cap = Math.max(16, Math.floor(cap));
    this.particles = []; // CPU structs: {active,pos,vel,life,maxLife,size,color,priority}

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveIntensity: 2.4,
      roughness: 1.0,
      metalness: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // particles fly everywhere; never cull the whole batch
    for (let i = 0; i < this.cap; i++) {
      this.particles.push({ active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 0.1, color: new THREE.Color(1, 1, 1), priority: 0 });
      this.mesh.setMatrixAt(i, HIDDEN);
      this.mesh.setColorAt(i, new THREE.Color(0, 0, 0));
    }
    scene.add(this.mesh);

    this._tmpMat = new THREE.Matrix4();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpScale = new THREE.Vector3();
    this._colA = new THREE.Color();
  }

  get activeCount() {
    let n = 0;
    for (const p of this.particles) if (p.active) n++;
    return n;
  }

  setCap(n) {
    const next = Math.max(16, Math.floor(n));
    if (next < this.cap && next <= this.mesh.count) {
      // hard-cap reduction: evict lowest-priority actives beyond the new cap
      let over = this.activeCount - next;
      if (over > 0) {
        const sorted = this.particles.filter(p => p.active).sort((a, b) => a.priority - b.priority);
        for (let i = 0; i < Math.min(over, sorted.length); i++) sorted[i].active = false;
      }
    }
    this.cap = next;
  }

  /**
   * Spawn a burst. `priority` (higher survives culling) defaults per preset:
   * explosions > sparks > thrusters. Returns number actually spawned.
   */
  burst(preset, position, opts = {}) {
    const cfg = PRESETS[preset] || PRESETS.sparks;
    const count = Math.round(randRange(cfg.count[0], cfg.count[1]));
    const priority = opts.priority ?? (preset === 'explosion' ? 3 : preset === 'sparks' ? 2 : 1);
    let spawned = 0;

    for (let i = 0; i < count; i++) {
      const p = this._acquire(priority);
      if (!p) break; // budget exhausted — culling already evicted lowest priority
      const speed = randRange(cfg.speed[0], cfg.speed[1]) * (opts.speedScale ?? 1);
      // isotropic direction with optional upward bias / cone
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(randRange(-1, 1));
      p.pos.copy(position).add(new THREE.Vector3(
        (opts.originOffset?.x ?? 0), (opts.originOffset?.y ?? 0) + (opts.upBias ?? 0.15 * speed * 0.2), (opts.originOffset?.z ?? 0),
      ));
      p.vel.set(Math.sin(phi) * Math.cos(theta) * speed, Math.cos(phi) * speed * (opts.yScale ?? 1), Math.sin(phi) * Math.sin(theta) * speed * 0.35);
      if (opts.velocityBias) p.vel.add(opts.velocityBias);
      p.maxLife = randRange(cfg.life[0], cfg.life[1]) * (opts.lifeScale ?? 1);
      p.life = p.maxLife;
      p.size = randRange(cfg.size[0], cfg.size[1]);
      const palette = opts.colors || cfg.colors;
      p.color.set(palette[(Math.random() * palette.length) | 0]);
      if (opts.tint) p.color.lerp(opts.tint, 0.35);
      p.gravity = cfg.gravity;
      p.priority = priority;
      spawned++;
    }
    return spawned;
  }

  /** Evict lowest-priority actives until a slot is free; return the struct or null if cap < 1. */
  _acquire(priority) {
    for (const p of this.particles) {
      if (!p.active) { p.active = true; return p; }
    }
    // over budget: evict lowest priority (ties broken by shortest remaining life)
    let victim = null;
    for (const p of this.particles) {
      if (p.priority < priority && (!victim || p.priority < victim.priority)) victim = p;
    }
    if (victim) { victim.active = false; return victim; }
    return null; // only equal/higher-priority particles alive — refuse to steal from them
  }

  update(dt, timescale = 1) {
    const t = dt * timescale;
    let anyActive = false;
    for (let i = 0; i < this.cap; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= t;
      if (p.life <= 0) { p.active = false; continue; }
      anyActive = true;
      p.vel.y += p.gravity * t;
      p.pos.addScaledVector(p.vel, t);

      const f = p.life / p.maxLife; // 1 → 0
      const s = p.size * (0.35 + 0.65 * f) * (f > 0.85 ? (1 - f) / 0.15 : 1); // pop-in, fade-out
      this._tmpMat.compose(p.pos, this._tmpQuat.identity(), this._tmpScale.set(s, s, s));
      this.mesh.setMatrixAt(i, this._tmpMat);
      const brightness = f * f; // ease-out glow
      this._colA.copy(p.color).multiplyScalar(brightness);
      this.mesh.setColorAt(i, this._colA);
    }
    if (anyActive || this._dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this._dirty = false;
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.particles.length = 0;
  }
}
