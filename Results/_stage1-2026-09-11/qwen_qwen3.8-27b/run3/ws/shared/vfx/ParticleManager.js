import * as THREE from 'three';
import { makeGlowSprite } from '../textures/ProceduralTextures.js';

/**
 * Centralized particle system. HARD CAP of 500 live particles, one
 * InstancedMesh draw call, structure-of-arrays storage. When saturated,
 * the oldest slot is stolen (ring cursor) — never allocates past the cap.
 */
export const PARTICLE_CAP = 500;

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class ParticleManager {
  constructor(scene, registry) {
    this.scene = scene;
    this.registry = registry;
    this.cap = PARTICLE_CAP;

    // Structure-of-arrays state
    this.px = new Float32Array(this.cap);
    this.py = new Float32Array(this.cap);
    this.pz = new Float32Array(this.cap);
    this.vx = new Float32Array(this.cap);
    this.vy = new Float32Array(this.cap);
    this.vz = new Float32Array(this.cap);
    this.life = new Float32Array(this.cap);
    this.maxLife = new Float32Array(this.cap);
    this.size = new Float32Array(this.cap);
    this.grav = new Float32Array(this.cap);
    this.drag = new Float32Array(this.cap);
    this.cr = new Float32Array(this.cap);
    this.cg = new Float32Array(this.cap);
    this.cb = new Float32Array(this.cap);
    this.alive = new Uint8Array(this.cap);

    this.freeList = [];
    for (let i = this.cap - 1; i >= 0; i--) this.freeList.push(i);
    this.stealCursor = 0;
    this.activeCount = 0;

    // One InstancedMesh, one material, one texture — all registered for disposal
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.texture = makeGlowSprite();
    // Unlit so particles read as pure emissive glow regardless of scene lighting.
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: this.texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    registry.track(this.geometry);
    registry.track(this.material);
    registry.track(this.texture);

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 20;

    // Per-instance color attribute
    const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = colorAttr;

    // Start everything dead
    for (let i = 0; i < this.cap; i++) {
      _dummy.position.set(0, -9999, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }

  /**
   * Spawn a burst.
   * @param {object} o
   * @param {THREE.Vector3|number[]} o.position
   * @param {number} [o.count=20]
   * @param {number} [o.speed=6]        mean speed (units/s)
   * @param {number} [o.spread=1]      0..1, 1 = full hemisphere
   * @param {number|string} [o.color=0x66ffff]
   * @param {number} [o.size=0.35]
   * @param {number} [o.life=0.8]
   * @param {number} [o.gravity=0]
   * @param {number} [o.drag=1.5]      exponential drag coefficient
   * @param {number} [o.direction=0]   bias angle (radians, XY plane)
   * @param {boolean} [o.cone=false]   narrow cone along +Y
   */
  burst(o) {
    const count = Math.min(Math.max(1, o.count | 0), this.cap);
    const px = o.position.x, py = o.position.y, pz = o.position.z;
    _color.set(o.color ?? 0x66ffff);
    const baseR = _color.r, baseG = _color.g, baseB = _color.b;
    const speed = o.speed ?? 6;
    const spread = o.spread ?? 1;
    const size = o.size ?? 0.35;
    const life = o.life ?? 0.8;
    const gravity = o.gravity ?? 0;
    const drag = o.drag ?? 1.5;
    const dir = o.direction ?? 0;
    const cone = o.cone ?? false;

    for (let n = 0; n < count; n++) {
      const i = this._alloc();
      if (i < 0) return; // cap reached and steal failed (should not happen)

      // Random direction
      let dx, dy, dz;
      if (cone) {
        const a = dir + (Math.random() - 0.5) * 0.6;
        dx = Math.cos(a); dy = Math.sin(a); dz = (Math.random() - 0.5) * 0.3;
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spread;
        dx = Math.cos(a) * r; dy = Math.sin(a) * r; dz = (Math.random() - 0.5) * 0.4;
        const len = Math.hypot(dx, dy, dz) || 1;
        dx /= len; dy /= len; dz /= len;
      }
      const s = speed * (0.4 + Math.random() * 0.9);

      this.px[i] = px; this.py[i] = py; this.pz[i] = pz;
      this.vx[i] = dx * s; this.vy[i] = dy * s; this.vz[i] = dz * s;
      const l = life * (0.6 + Math.random() * 0.8);
      this.life[i] = l; this.maxLife[i] = l;
      this.size[i] = size * (0.6 + Math.random() * 0.8);
      this.grav[i] = gravity;
      this.drag[i] = drag;
      // Slight per-particle hue jitter
      const j = 0.85 + Math.random() * 0.3;
      this.cr[i] = Math.min(1, baseR * j);
      this.cg[i] = Math.min(1, baseG * j);
      this.cb[i] = Math.min(1, baseB * j);
      this.alive[i] = 1;
    }
  }

  _alloc() {
    const i = this.freeList.pop();
    if (i !== undefined) return i;
    // Saturated: steal the oldest slot (ring cursor)
    const s = this.stealCursor;
    this.stealCursor = (this.stealCursor + 1) % this.cap;
    return s;
  }

  _kill(i) {
    if (!this.alive[i]) return;
    this.alive[i] = 0;
    this.life[i] = 0;
    this.freeList.push(i);
    this.activeCount--;
  }

  update(dt, camera) {
    if (this.activeCount === 0) { this.mesh.count = 0; return; }
    const dragDt = dt;
    let live = 0;
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this._kill(i); continue; }
      const k = Math.exp(-this.drag[i] * dragDt);
      this.vx[i] *= k; this.vy[i] *= k; this.vz[i] *= k;
      this.vy[i] -= this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;

      const t = this.life[i] / this.maxLife[i]; // 1 → 0
      const s = this.size[i] * (0.3 + 0.7 * t);
      _dummy.position.set(this.px[i], this.py[i], this.pz[i]);
      if (camera) _dummy.quaternion.copy(camera.quaternion);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
      this.mesh.instanceColor.setXYZ(i, this.cr[i] * t, this.cg[i] * t, this.cb[i] * t);
      live++;
    }
    this.mesh.count = this.cap; // matrices of dead slots are stale; hide via scale below
    // Hide dead slots by zeroing their scale (cheap: only touched when count changes)
    this._hideDead();
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.activeCount = live;
  }

  _hideDead() {
    _dummy.scale.setScalar(0.0001);
    _dummy.position.set(0, -9999, 0);
    _dummy.updateMatrix();
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i]) this.mesh.setMatrixAt(i, _dummy.matrix);
    }
  }

  clear() {
    for (let i = 0; i < this.cap; i++) {
      if (this.alive[i]) { this.alive[i] = 0; this.life[i] = 0; }
    }
    this.freeList.length = 0;
    for (let i = this.cap - 1; i >= 0; i--) this.freeList.push(i);
    this.activeCount = 0;
    this.mesh.count = 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    // geometry / material / texture disposed via registry.disposeAll()
  }
}
