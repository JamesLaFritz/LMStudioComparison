// shared/core/ParticleManager.js
// Centralized particle system. HARD CAP of 500 active particles.
// One InstancedMesh -> one draw call for the entire particle field.
// CPU-integrated (position/velocity/life per instance), zero per-frame allocation.

import * as THREE from 'three';

const HARD_CAP = 500;

export class ParticleManager {
  constructor(scene, { cap = HARD_CAP, size = 0.09, gravity = -9.0 } = {}) {
    this.scene = scene;
    this.cap = Math.min(cap, HARD_CAP);
    this.gravity = gravity;

    this.count = 0; // active particles

    // Per-instance CPU state (flat arrays, no GC)
    this.pos = new Float32Array(this.cap * 3);
    this.vel = new Float32Array(this.cap * 3);
    this.life = new Float32Array(this.cap);
    this.maxLife = new Float32Array(this.cap);
    this.size = new Float32Array(this.cap);
    this.drag = new Float32Array(this.cap);
    this.color = new Float32Array(this.cap * 3);
    this.active = new Uint8Array(this.cap);
    this.__grav = new Float32Array(this.cap);

    // Geometry: unit quad (billboarded via instance matrix orientation each frame)
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.mesh.count = 0;
    scene.add(this.mesh);

    this._matrix = new THREE.Matrix4();
    this._quat = new THREE.Quaternion();
    this._scale = new THREE.Vector3();
    this._posV = new THREE.Vector3();
    this._colorObj = new THREE.Color();
    this._burstColor = new THREE.Color();
    this._up = new THREE.Vector3(0, 1, 0);
    this._cursor = 0;
  }

  // Spawn a burst. Returns the number actually spawned (may be < count if cap reached).
  burst({
    origin,
    count = 20,
    velocity = 0,
    spread = 1.0,
    direction = null, // optional THREE.Vector3 bias
    color = 0xffffff,
    colorVariance = 0.15,
    size = 1.0,
    life = 0.8,
    lifeVariance = 0.3,
    gravity = null,
    drag = 1.5,
  }) {
    const col = this._burstColor.set(color);
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const idx = this._findSlot();
      if (idx < 0) break;
      const i3 = idx * 3;

      // Random direction on sphere, biased by `direction` if given
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      let dx = Math.sin(phi) * Math.cos(theta);
      let dy = Math.sin(phi) * Math.sin(theta);
      let dz = Math.cos(phi);
      if (direction) {
        dx = dx * 0.35 + direction.x * 0.65;
        dy = dy * 0.35 + direction.y * 0.65;
        dz = dz * 0.35 + direction.z * 0.65;
        const len = Math.hypot(dx, dy, dz) || 1;
        dx /= len; dy /= len; dz /= len;
      }

      const speed = velocity * (0.4 + Math.random() * spread);
      this.pos[i3] = origin.x;
      this.pos[i3 + 1] = origin.y;
      this.pos[i3 + 2] = origin.z;
      this.vel[i3] = dx * speed;
      this.vel[i3 + 1] = dy * speed;
      this.vel[i3 + 2] = dz * speed;

      const l = life * (1 - lifeVariance * Math.random());
      this.life[idx] = l;
      this.maxLife[idx] = l;
      this.size[idx] = size * (0.6 + Math.random() * 0.8);
      this.drag[idx] = drag;
      this._grav[idx] = gravity !== null ? gravity : this.gravity;

      const v = colorVariance * (Math.random() - 0.5);
      this.color[i3] = Math.max(0, col.r + v);
      this.color[i3 + 1] = Math.max(0, col.g + v);
      this.color[i3 + 2] = Math.max(0, col.b + v);
      this.active[idx] = 1;
      spawned++;
    }
    return spawned;
  }

  _findSlot() {
    // Rotating cursor: prefer the next dead slot; if the field is full,
    // recycle the oldest (lowest remaining life) so the cap is never exceeded.
    for (let n = 0; n < this.cap; n++) {
      const i = (this._cursor + n) % this.cap;
      if (!this.active[i]) {
        this._cursor = (i + 1) % this.cap;
        return i;
      }
    }
    let oldest = 0;
    let oldestLife = Infinity;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] < oldestLife) {
        oldestLife = this.life[i];
        oldest = i;
      }
    }
    this._cursor = (oldest + 1) % this.cap;
    return oldest;
  }

  update(dt) {
    if (this.count === 0 && !this._anyActive()) {
      this.mesh.count = 0;
      return;
    }
    let live = 0;
    for (let i = 0; i < this.cap; i++) {
      if (!this.active[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.active[i] = 0;
        continue;
      }
      const i3 = i * 3;
      // Integrate
      const dragF = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dragF;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dragF + (this._grav ? this._grav[i] : this.gravity) * dt;
      this.vel[i3 + 2] *= dragF;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;

      // Write instance matrix (billboard: face +Z toward camera by identity rotation is fine
      // for a plane quad viewed from the front; scale by life fraction)
      const t = this.life[i] / this.maxLife[i];
      const s = this.size[i] * (0.3 + 0.7 * t);
      this._posV.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]);
      this._scale.set(s, s, s);
      this._matrix.compose(this._posV, this._quat, this._scale);
      this.mesh.setMatrixAt(live, this._matrix);

      // Color fades out with life
      const fade = t < 0.4 ? t / 0.4 : 1.0;
      this._colorObj.setRGB(
        this.color[i3] * fade,
        this.color[i3 + 1] * fade,
        this.color[i3 + 2] * fade
      );
      this.mesh.setColorAt(live, this._colorObj);
      live++;
    }
    this.count = live;
    this.mesh.count = live;
    if (live > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  _anyActive() {
    for (let i = 0; i < this.cap; i++) if (this.active[i]) return true;
    return false;
  }

  // Initialize the per-instance gravity array lazily (avoids a large allocation in ctor path
  // that some bundlers tree-shake oddly).
  get _grav() {
    if (!this.__grav) this.__grav = new Float32Array(this.cap);
    return this.__grav;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
