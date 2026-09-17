import * as THREE from 'three';
import { MAX_ACTIVE_PARTICLES } from '../utils/Constants.js';

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _scaleVec = new THREE.Vector3();
const _zeroScale = new THREE.Vector3(0, 0, 0);
const _identityQuat = new THREE.Quaternion();
const _tmpColor = new THREE.Color();

/**
 * Centralized particle system for the whole collection. Backed by a single
 * InstancedMesh capped at MAX_ACTIVE_PARTICLES (500) — the mesh always draws
 * `capacity` instances in one draw call; inactive slots are zero-scaled so
 * they cost nothing visually. When capacity is exhausted, the oldest active
 * particle is evicted to make room for a new one (hard cap, never grows).
 */
export class ParticleManager {
  constructor(scene, { capacity = MAX_ACTIVE_PARTICLES, disposer = null } = {}) {
    this._capacity = capacity;

    this._geometry = new THREE.OctahedronGeometry(0.12, 0);
    this._material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.1,
      roughness: 0.35,
      metalness: 0.05,
      transparent: true,
      opacity: 1
    });
    disposer?.trackGeometry(this._geometry);
    disposer?.trackMaterial(this._material);

    this._mesh = new THREE.InstancedMesh(this._geometry, this._material, capacity);
    this._mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._mesh.frustumCulled = false;
    this._mesh.count = capacity;

    for (let i = 0; i < capacity; i++) {
      _matrix.compose(_position, _identityQuat, _zeroScale);
      this._mesh.setMatrixAt(i, _matrix);
      this._mesh.setColorAt(i, _tmpColor.set(0xffffff));
    }
    this._mesh.instanceMatrix.needsUpdate = true;
    if (this._mesh.instanceColor) this._mesh.instanceColor.needsUpdate = true;

    scene.add(this._mesh);

    this._velX = new Float32Array(capacity);
    this._velY = new Float32Array(capacity);
    this._velZ = new Float32Array(capacity);
    this._posX = new Float32Array(capacity);
    this._posY = new Float32Array(capacity);
    this._posZ = new Float32Array(capacity);
    this._life = new Float32Array(capacity);
    this._maxLife = new Float32Array(capacity);
    this._baseScale = new Float32Array(capacity);
    this._drag = new Float32Array(capacity);
    this._gravity = new Float32Array(capacity);
    this._active = new Uint8Array(capacity);

    this._freeList = [];
    for (let i = capacity - 1; i >= 0; i--) this._freeList.push(i);
    this._activeQueue = [];
  }

  spawn({ x, y, z, vx = 0, vy = 0, vz = 0, life = 0.5, size = 0.15, color = 0xffffff, drag = 0.9, gravity = 0 }) {
    let index;
    if (this._freeList.length > 0) {
      index = this._freeList.pop();
    } else if (this._activeQueue.length > 0) {
      index = this._activeQueue.shift();
    } else {
      return;
    }

    this._active[index] = 1;
    this._posX[index] = x;
    this._posY[index] = y;
    this._posZ[index] = z;
    this._velX[index] = vx;
    this._velY[index] = vy;
    this._velZ[index] = vz;
    this._life[index] = life;
    this._maxLife[index] = life;
    this._baseScale[index] = size;
    this._drag[index] = drag;
    this._gravity[index] = gravity;
    this._activeQueue.push(index);

    this._mesh.setColorAt(index, _tmpColor.set(color));
    if (this._mesh.instanceColor) this._mesh.instanceColor.needsUpdate = true;
  }

  /** Radial burst helper — the common case for explosions/sparks. */
  burst({
    x, y, z,
    count = 12,
    speed = 4,
    speedVariance = 2,
    life = 0.5,
    lifeVariance = 0.2,
    size = 0.15,
    color = 0xffffff,
    gravity = 0,
    spread = Math.PI * 2,
    upBias = 0.3
  }) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * spread;
      const s = Math.max(0.1, speed + (Math.random() * 2 - 1) * speedVariance);
      const vx = Math.cos(angle) * s;
      const vz = Math.sin(angle) * s;
      const vy = Math.random() * s * upBias;
      const l = Math.max(0.05, life + (Math.random() * 2 - 1) * lifeVariance);
      this.spawn({ x, y, z, vx, vy, vz, life: l, size, color, gravity });
    }
  }

  update(dt) {
    if (dt <= 0) return;
    let writeIndex = 0;
    const dragFrames = dt * 60;

    for (let k = 0; k < this._activeQueue.length; k++) {
      const index = this._activeQueue[k];
      this._life[index] -= dt;

      if (this._life[index] <= 0) {
        this._active[index] = 0;
        this._freeList.push(index);
        _matrix.compose(_position.set(0, 0, 0), _identityQuat, _zeroScale);
        this._mesh.setMatrixAt(index, _matrix);
        continue;
      }

      const dragFactor = Math.pow(this._drag[index], dragFrames);
      this._velX[index] *= dragFactor;
      this._velZ[index] *= dragFactor;
      this._velY[index] += this._gravity[index] * dt;

      this._posX[index] += this._velX[index] * dt;
      this._posY[index] += this._velY[index] * dt;
      this._posZ[index] += this._velZ[index] * dt;

      const t = 1 - this._life[index] / this._maxLife[index];
      const scale = Math.max(this._baseScale[index] * (1 - t), 0.0001);

      _position.set(this._posX[index], this._posY[index], this._posZ[index]);
      _scaleVec.set(scale, scale, scale);
      _matrix.compose(_position, _identityQuat, _scaleVec);
      this._mesh.setMatrixAt(index, _matrix);

      this._activeQueue[writeIndex++] = index;
    }
    this._activeQueue.length = writeIndex;
    this._mesh.instanceMatrix.needsUpdate = true;
  }

  get activeCount() {
    return this._activeQueue.length;
  }

  get capacity() {
    return this._capacity;
  }

  get mesh() {
    return this._mesh;
  }

  dispose(scene) {
    scene.remove(this._mesh);
    this._mesh.dispose();
    this._geometry.dispose();
    this._material.dispose();
  }
}
