import * as THREE from 'three';
import { randRange, clamp } from '../utils/Math.js';

/**
 * Centralized particle system.
 *
 * - ONE InstancedMesh for every particle in the scene (single draw call).
 * - HARD CAP of `maxParticles` (500 by default) live particles, enforced by a
 *   ring buffer: when the pool is saturated the oldest particle is recycled.
 * - Zero per-frame allocation: all state lives in pre-allocated Float32Arrays.
 * - Particles are billboarded planes with per-instance color and a soft
 *   radial-gradient alpha map (procedural), so they read as glowing embers
 *   under bloom without any custom shaders.
 */
export class ParticleManager {
  constructor(scene, { maxParticles = 500, alphaMap = null } = {}) {
    this.max = maxParticles;
    this.scene = scene;
    this.ring = 0;

    // State arrays (SoA layout, all pre-allocated).
    this.px = new Float32Array(maxParticles);
    this.py = new Float32Array(maxParticles);
    this.pz = new Float32Array(maxParticles);
    this.vx = new Float32Array(maxParticles);
    this.vy = new Float32Array(maxParticles);
    this.vz = new Float32Array(maxParticles);
    this.life = new Float32Array(maxParticles);
    this.maxLife = new Float32Array(maxParticles);
    this.size = new Float32Array(maxParticles);
    this.grav = new Float32Array(maxParticles);
    this.drag = new Float32Array(maxParticles);
    this.cr = new Float32Array(maxParticles);
    this.cg = new Float32Array(maxParticles);
    this.cb = new Float32Array(maxParticles);
    this.active = new Uint8Array(maxParticles);
    this.count = 0;

    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      alphaMap: alphaMap || null,
      alphaTest: 0.01,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxParticles);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;

    // Allocate instanceColor and hide every instance at scale 0.
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(0, 0, 0);
    const p = new THREE.Vector3();
    for (let i = 0; i < maxParticles; i++) {
      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, _WHITE);
    }
    this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);

    // Scratch objects (reused every frame — no allocation in update()).
    this._m = m;
    this._q = q;
    this._s = s;
    this._p = p;
    this._c = new THREE.Color();
  }

  /**
   * Spawn a burst of particles.
   * @param {THREE.Vector3} origin
   * @param {object} o
   *   count, speed [min,max], size [min,max], life [min,max],
   *   color (hex or [hex,...] palette), dir (bias vector), spread (0..1 cone),
   *   gravity, drag
   */
  burst(origin, o = {}) {
    const count = Math.min(o.count ?? 24, this.max);
    const palette = Array.isArray(o.color) ? o.color : [o.color ?? 0x00ffff];
    const dir = o.dir || null;
    const spread = o.spread ?? 1;
    for (let n = 0; n < count; n++) {
      const i = this._alloc();
      this.px[i] = origin.x + (Math.random() - 0.5) * 0.15;
      this.py[i] = origin.y + (Math.random() - 0.5) * 0.15;
      this.pz[i] = origin.z + (Math.random() - 0.5) * 0.15;

      // Direction: random on sphere, biased toward `dir` by `spread`.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      let dx = Math.sin(phi) * Math.cos(theta);
      let dy = Math.sin(phi) * Math.sin(theta);
      let dz = Math.cos(phi);
      if (dir) {
        dx = dx * (1 - spread) + dir.x * spread;
        dy = dy * (1 - spread) + dir.y * spread;
        dz = dz * (1 - spread) + dir.z * spread;
        const len = Math.hypot(dx, dy, dz) || 1;
        dx /= len; dy /= len; dz /= len;
      }
      const speed = randRange(o.speed?.[0] ?? 2, o.speed?.[1] ?? 6);
      this.vx[i] = dx * speed;
      this.vy[i] = dy * speed;
      this.vz[i] = dz * speed;

      this.life[i] = this.maxLife[i] = randRange(o.life?.[0] ?? 0.4, o.life?.[1] ?? 0.9);
      this.size[i] = randRange(o.size?.[0] ?? 0.08, o.size?.[1] ?? 0.22);
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 0;
      const col = palette[(Math.random() * palette.length) | 0];
      this._c.setHex(col);
      this.cr[i] = this._c.r;
      this.cg[i] = this._c.g;
      this.cb[i] = this._c.b;
      this.active[i] = 1;
    }
  }

  /** Continuous stream (e.g. thruster exhaust). */
  stream(origin, o = {}) {
    const n = Math.min(o.count ?? 1, this.max);
    for (let k = 0; k < n; k++) {
      const i = this._alloc();
      this.px[i] = origin.x + (Math.random() - 0.5) * (o.jitter ?? 0.1);
      this.py[i] = origin.y + (Math.random() - 0.5) * (o.jitter ?? 0.1);
      this.pz[i] = origin.z + (Math.random() - 0.5) * (o.jitter ?? 0.1);
      const dir = o.dir;
      const speed = randRange(o.speed?.[0] ?? 1, o.speed?.[1] ?? 3);
      this.vx[i] = dir.x * speed + (Math.random() - 0.5) * (o.spreadVel ?? 0.5);
      this.vy[i] = dir.y * speed + (Math.random() - 0.5) * (o.spreadVel ?? 0.5);
      this.vz[i] = dir.z * speed + (Math.random() - 0.5) * (o.spreadVel ?? 0.5);
      this.life[i] = this.maxLife[i] = randRange(o.life?.[0] ?? 0.2, o.life?.[1] ?? 0.5);
      this.size[i] = randRange(o.size?.[0] ?? 0.05, o.size?.[1] ?? 0.14);
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 0;
      const col = o.color ?? 0x00ffff;
      this._c.setHex(col);
      this.cr[i] = this._c.r;
      this.cg[i] = this._c.g;
      this.cb[i] = this._c.b;
      this.active[i] = 1;
    }
  }

  /** Ring-buffer allocation: recycles the oldest slot when saturated. */
  _alloc() {
    const i = this.ring;
    this.ring = (this.ring + 1) % this.max;
    if (!this.active[i]) this.count++;
    return i;
  }

  update(dt, camera) {
    if (dt <= 0) return;
    const m = this._m, q = this._q, s = this._s, p = this._p, c = this._c;
    let live = 0;
    for (let i = 0; i < this.max; i++) {
      if (!this.active[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.active[i] = 0;
        m.compose(p.set(0, -9999, 0), q, s.set(0, 0, 0));
        this.mesh.setMatrixAt(i, m);
        continue;
      }
      live++;
      const dragK = this.drag[i] > 0 ? Math.max(0, 1 - this.drag[i] * dt) : 1;
      this.vx[i] *= dragK;
      this.vy[i] = this.vy[i] * dragK - this.grav[i] * dt;
      this.vz[i] *= dragK;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;

      const t = this.life[i] / this.maxLife[i]; // 1 → 0
      const scale = this.size[i] * (0.35 + 0.65 * t);
      p.set(this.px[i], this.py[i], this.pz[i]);
      q.copy(camera.quaternion); // billboard
      s.set(scale, scale, scale);
      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
      // Fade toward black (additive blending → fades out visually).
      const fade = t < 0.4 ? t / 0.4 : 1;
      c.setRGB(this.cr[i] * fade, this.cg[i] * fade, this.cb[i] * fade);
      this.mesh.setColorAt(i, c);
    }
    this.count = live;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.active.fill(0);
    this.count = 0;
    const m = this._m, q = this._q, s = this._s, p = this._p;
    for (let i = 0; i < this.max; i++) {
      m.compose(p.set(0, -9999, 0), q, s.set(0, 0, 0));
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

const _WHITE = new THREE.Color(0xffffff);
