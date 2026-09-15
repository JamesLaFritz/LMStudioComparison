// shared/vfx/ParticleManager.js
// Centralized particle system. Single InstancedMesh (1 draw call), hard cap 500 live
// particles, structure-of-arrays state for zero hot-path allocation, priority-based
// eviction of the oldest lowest-priority slot when over budget.

import * as THREE from 'three';
import { clamp } from '../utils/math.js';

const MAX = 500; // hard cap — structural, not advisory
const BUDGET_GUARD = 420; // above this, P0 spawns are dropped silently

// Preallocated SoA state.
const px = new Float32Array(MAX);
const py = new Float32Array(MAX);
const pz = new Float32Array(MAX);
const vx = new Float32Array(MAX);
const vy = new Float32Array(MAX);
const vz = new Float32Array(MAX);
const life = new Float32Array(MAX); // remaining seconds
const maxLife = new Float32Array(MAX);
const size = new Float32Array(MAX);
const drag = new Float32Array(MAX);
const gravity = new Float32Array(MAX);
const priority = new Uint8Array(MAX);
const spin = new Float32Array(MAX); // angular velocity for orientation
const angle = new Float32Array(MAX);

// Free list: indices of dead slots, LIFO.
const freeList = new Int32Array(MAX);
let freeCount = 0;
for (let i = 0; i < MAX; i++) { freeList[i] = i; }

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.activeCount = 0;

    // Unit box, centered — stretched per-instance for velocity-aligned sparks.
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 3.2, // crosses bloom threshold → sparks glow
      roughness: 0.4,
      metalness: 0.1,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // particles fly everywhere — never cull the batch
    this.mesh.renderOrder = 20;
    scene.add(this.mesh);

    // Per-instance color (white base → tinted per spawn).
    for (let i = 0; i < MAX; i++) {
      this.mesh.setColorAt(i, _color.setRGB(1, 1, 1));
      _m4.makeScale(0, 0, 0); // dead instances hidden by zero scale
      this.mesh.setMatrixAt(i, _m4);
    }
    this.mesh.instanceColor.needsUpdate = true;

    this._geo = geo;
    this._mat = mat;
  }

  /**
   * Spawn one particle. Returns false if over budget and priority is P0.
   * @param {number} x,y,z position
   * @param {object} o options: vx,vy,vz, life, size, color (hex), drag, gravity, priority (0-3)
   */
  spawn(x, y, z, o = {}) {
    const pr = clamp(o.priority ?? 1, 0, 3);
    if (this.activeCount >= BUDGET_GUARD && pr === 0) return false;

    let idx;
    if (freeCount > 0) {
      idx = freeList[--freeCount];
    } else {
      // Over cap: evict lowest-priority oldest slot.
      idx = this._findEviction();
    }

    px[idx] = x; py[idx] = y; pz[idx] = z;
    vx[idx] = o.vx ?? 0; vy[idx] = o.vy ?? 0; vz[idx] = o.vz ?? 0;
    life[idx] = o.life ?? 0.6; maxLife[idx] = life[idx];
    size[idx] = o.size ?? 0.12;
    drag[idx] = o.drag ?? 1.5;
    gravity[idx] = o.gravity ?? -9.8;
    priority[idx] = pr;
    spin[idx] = (Math.random() - 0.5) * 14;
    angle[idx] = Math.random() * Math.PI * 2;

    _color.set(o.color ?? 0x66ffff);
    this.mesh.setColorAt(idx, _color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.activeCount++;
    return true;
  }

  /** Eviction: lowest priority first, then oldest (smallest remaining life). */
  _findEviction() {
    let best = -1;
    let bestKey = Infinity;
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue; // already dead, will be freed next update
      const key = priority[i] * 1e6 + life[i]; // low priority + old → small key
      if (key < bestKey) { bestKey = key; best = i; }
    }
    return best >= 0 ? best : 0; // all-dead fallback (shouldn't happen under guard)
  }

  /** Burst helper: N particles in a hemisphere/sphere around a point. */
  burst(x, y, z, count, { color = 0x66ffff, speed = 8, spread = Math.PI / 2, life = 0.7, size = 0.14, priority = 2, upBias = 0.5 } = {}) {
    for (let i = 0; i < count; i++) {
      // Random direction biased upward by `upBias` in [−1..1].
      const theta = Math.random() * Math.PI * 2;
      const cosPhi = 1 - Math.random() * 2; // uniform on sphere
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      let dx = Math.cos(theta) * sinPhi;
      let dy = cosPhi;
      let dz = Math.sin(theta) * sinPhi;
      // Blend toward +Y by upBias.
      dx *= (1 - upBias); dy = dy * (1 - upBias) + upBias; dz *= (1 - upBias);
      const len = Math.hypot(dx, dy, dz) || 1;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.spawn(x, y, z, {
        vx: dx / len * sp, vy: dy / len * sp, vz: dz / len * sp,
        life: life * (0.6 + Math.random() * 0.7), size: size * (0.7 + Math.random() * 0.8),
        color, priority, drag: 2.2, gravity: -4,
      });
    }
  }

  /** Velocity-aligned spark streaks — stretched along velocity for the "laser impact" read. */
  sparks(x, y, z, dirX, dirZ, count = 10, color = 0xaef7ff) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 6 + Math.random() * 14;
      this.spawn(x, y, z, {
        vx: dirX * sp * (0.3 + Math.random()) + Math.cos(a) * 5,
        vy: 2 + Math.random() * 8,
        vz: dirZ * sp * (0.3 + Math.random()) + Math.sin(a) * 5,
        life: 0.25 + Math.random() * 0.3, size: 0.16, color, priority: 2, drag: 3.5, gravity: -18,
      });
    }
  }

  /** Advance simulation at REAL time (independent of hit-stop timescale). */
  update(dt) {
    let anyAlive = false;
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) {
        freeList[freeCount++] = i;
        this.activeCount--;
        _m4.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m4);
        continue;
      }
      anyAlive = true;

      // Integrate.
      const d = Math.exp(-drag[i] * dt);
      vx[i] *= d; vz[i] *= d;
      vy[i] = vy[i] * d + gravity[i] * dt;
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;

      // Floor bounce (playfield at y=0).
      if (py[i] < 0.05 && vy[i] < 0) { py[i] = 0.05; vy[i] *= -0.4; }

      angle[i] += spin[i] * dt;

      // Fade: scale shrinks over last third of life.
      const t = life[i] / maxLife[i];
      const fade = t < 0.33 ? t / 0.33 : 1;
      const s = size[i] * (0.5 + 0.5 * fade);

      // Velocity-aligned stretch for fast particles (spark read).
      const speed2 = vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i];
      let sx = s, sy = s, sz = s;
      if (speed2 > 16) { // >4 u/s → stretch along velocity
        const sp = Math.sqrt(speed2);
        const k = Math.min(3.0, 1 + sp * 0.12);
        sx *= k; sy *= k; sz *= k;
      }

      _euler.set(0, angle[i], 0);
      _q.setFromEuler(_euler);
      _pos.set(px[i], py[i], pz[i]);
      _scale.set(sx, sy, sz);
      _m4.compose(_pos, _q, _scale);
      this.mesh.setMatrixAt(i, _m4);
    }

    if (anyAlive || freeCount < MAX) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Kill all live particles (wave transitions). */
  clear() {
    for (let i = 0; i < MAX; i++) {
      if (life[i] > 0) {
        life[i] = 0;
        freeList[freeCount++] = i;
        this.activeCount--;
        _m4.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m4);
      }
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this._geo.dispose();
    this._mat.dispose();
    // InstancedMesh disposes its own instance buffers with the geometry.
  }
}
