import * as THREE from 'three';
import { easeOutCubic } from '../math/easing.js';

/**
 * Centralized particle system with a HARD CAP of `maxParticles` (default 500).
 *
 * Implementation:
 *  - ONE InstancedMesh (maxParticles instances) with per-instance color, so
 *    any color can be used and there is no per-bucket capacity to overflow.
 *  - A ring-buffer head advances across the whole pool; when the cap is
 *    exceeded the OLDEST particle is recycled — the cap can never be exceeded
 *    and the system is a single draw call.
 *  - Particles are billboarded quads (PlaneGeometry) scaled per-instance;
 *    additive blending + emissive material makes them read as light.
 *
 * All particle state lives in flat Float32Arrays (SoA) for cache-friendly
 * updates. No per-particle objects are allocated at runtime.
 */
export class ParticleManager {
  constructor({ maxParticles = 500, colors = null } = {}) {
    this.maxParticles = maxParticles;

    // Fallback palette for colors that are not explicitly requested.
    this.colors = colors || [0x00f0ff, 0xff2bd6, 0xffd166, 0xffffff];

    // SoA state
    this.px = new Float32Array(this.maxParticles);
    this.py = new Float32Array(this.maxParticles);
    this.pz = new Float32Array(this.maxParticles);
    this.vx = new Float32Array(this.maxParticles);
    this.vy = new Float32Array(this.maxParticles);
    this.vz = new Float32Array(this.maxParticles);
    this.age = new Float32Array(this.maxParticles);
    this.life = new Float32Array(this.maxParticles);
    this.size0 = new Float32Array(this.maxParticles);
    this.size1 = new Float32Array(this.maxParticles);
    this.gravity = new Float32Array(this.maxParticles);
    this.drag = new Float32Array(this.maxParticles);
    this.cr = new Float32Array(this.maxParticles);
    this.cg = new Float32Array(this.maxParticles);
    this.cb = new Float32Array(this.maxParticles);
    this.alive = new Uint8Array(this.maxParticles);

    this.head = 0; // next slot to write (ring buffer)
    this.activeCount = 0;

    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._mesh = null;
    this._scene = null;
    this._disposed = false;
  }

  attach(scene, tracker = null) {
    this._scene = scene;
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 1.0,
      metalness: 0.0,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    // Hide all instances initially.
    this._dummy.scale.setScalar(0);
    this._dummy.updateMatrix();
    for (let i = 0; i < this.maxParticles; i++) mesh.setMatrixAt(i, this._dummy.matrix);
    scene.add(mesh);
    this._mesh = mesh;
    // Register GPU resources for the dispose cascade.
    if (tracker) { tracker.track(geo); tracker.track(mat); tracker.track(mesh); }
    return this;
  }

  /**
   * Spawn a single particle.
   * @param {number} x @param {number} y @param {number} z
   * @param {object} [opts]
   *   vx,vy,vz, life, size0, size1, gravity, drag, color (hex)
   */
  spawn(x, y, z, opts = {}) {
    const i = this.head;
    this.head = (this.head + 1) % this.maxParticles;
    if (this.alive[i] === 1) this.activeCount--; // recycling a live one

    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = opts.vx ?? 0;
    this.vy[i] = opts.vy ?? 0;
    this.vz[i] = opts.vz ?? 0;
    this.age[i] = 0;
    this.life[i] = opts.life ?? 0.6;
    this.size0[i] = opts.size0 ?? 0.22;
    this.size1[i] = opts.size1 ?? 0.02;
    this.gravity[i] = opts.gravity ?? 0;
    this.drag[i] = opts.drag ?? 0;
    this.alive[i] = 1;
    this.activeCount++;

    // Per-instance color (falls back to the palette if none given).
    const c = opts.color != null ? opts.color : this.colors[i % this.colors.length];
    this._color.set(c);
    this.cr[i] = this._color.r;
    this.cg[i] = this._color.g;
    this.cb[i] = this._color.b;
  }

  /**
   * Radial burst.
   * @param {number} count particles (capped by the ring buffer)
   * @param {number} speed base speed
   * @param {object} [opts] spread (0..1), upBias, color, life, size0, size1, gravity, drag
   */
  burst(x, y, z, count, speed, opts = {}) {
    const spread = opts.spread ?? 1.0;
    const upBias = opts.upBias ?? 0.25;
    for (let n = 0; n < count; n++) {
      // uniform-ish direction on a sphere, biased upward
      const a = Math.random() * Math.PI * 2;
      const c = Math.random() * 2 - 1; // cos(theta)
      const s = Math.sqrt(Math.max(0, 1 - c * c));
      let dx = s * Math.cos(a);
      let dy = c * spread;
      let dz = s * Math.sin(a);
      dy += upBias;
      const len = Math.hypot(dx, dy, dz) || 1;
      const sp = speed * (0.55 + Math.random() * 0.75);
      this.spawn(x, y, z, {
        vx: (dx / len) * sp,
        vy: (dy / len) * sp,
        vz: (dz / len) * sp,
        life: (opts.life ?? 0.55) * (0.7 + Math.random() * 0.6),
        size0: (opts.size0 ?? 0.22) * (0.7 + Math.random() * 0.7),
        size1: opts.size1 ?? 0.02,
        gravity: opts.gravity ?? 0,
        drag: opts.drag ?? 2.0,
        color: opts.color,
      });
    }
  }

  /**
   * Directional stream (e.g. engine exhaust).
   */
  stream(x, y, z, dirX, dirY, dirZ, count, speed, opts = {}) {
    for (let n = 0; n < count; n++) {
      const jx = (Math.random() - 0.5) * (opts.jitter ?? 0.35);
      const jy = (Math.random() - 0.5) * (opts.jitter ?? 0.35);
      const jz = (Math.random() - 0.5) * (opts.jitter ?? 0.35);
      const sp = speed * (0.7 + Math.random() * 0.6);
      this.spawn(x, y, z, {
        vx: dirX * sp + jx,
        vy: dirY * sp + jy,
        vz: dirZ * sp + jz,
        life: (opts.life ?? 0.35) * (0.6 + Math.random() * 0.8),
        size0: (opts.size0 ?? 0.16) * (0.7 + Math.random() * 0.6),
        size1: 0.01,
        gravity: opts.gravity ?? 0,
        drag: opts.drag ?? 1.0,
        color: opts.color,
      });
    }
  }

  update(dt, camera) {
    if (this._disposed) return;
    const { px, py, pz, vx, vy, vz, age, life, size0, size1, gravity, drag, alive } = this;
    const camQ = camera.quaternion;
    const mesh = this._mesh;
    let n = 0;

    for (let i = 0; i < this.maxParticles; i++) {
      if (alive[i] === 0) continue;
      age[i] += dt;
      if (age[i] >= life[i]) {
        alive[i] = 0;
        this.activeCount--;
        continue;
      }
      const t = age[i] / life[i];
      // integrate
      const d = drag[i] > 0 ? Math.exp(-drag[i] * dt) : 1;
      vx[i] *= d; vz[i] *= d;
      vy[i] = vy[i] * d + gravity[i] * dt;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      pz[i] += vz[i] * dt;

      // write instance matrix (billboard via camera quaternion)
      const k = 1 - easeOutCubic(t); // 1 → 0
      const scale = Math.max(0.0001, size0[i] + (size1[i] - size0[i]) * t);
      this._dummy.position.set(px[i], py[i], pz[i]);
      this._dummy.quaternion.copy(camQ);
      this._dummy.scale.setScalar(scale);
      this._dummy.updateMatrix();
      mesh.setMatrixAt(n, this._dummy.matrix);
      this._color.setRGB(this.cr[i], this.cg[i], this.cb[i]);
      mesh.setColorAt(n, this._color);
      n++;
    }

    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.alive.fill(0);
    this.activeCount = 0;
    if (this._mesh) {
      this._mesh.count = 0;
      this._dummy.scale.setScalar(0);
      this._dummy.updateMatrix();
      for (let i = 0; i < this.maxParticles; i++) this._mesh.setMatrixAt(i, this._dummy.matrix);
      this._mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this._mesh) {
      if (this._scene) this._scene.remove(this._mesh);
      this._mesh.geometry.dispose();
      this._mesh.material.dispose();
      this._mesh.dispose?.();
    }
    this._mesh = null;
  }
}
