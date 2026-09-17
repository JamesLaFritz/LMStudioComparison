import * as THREE from 'three';
import { createStandardMaterial } from '../rendering/MaterialFactory.js';

export const PARTICLE_HARD_CAP = 500;

/**
 * A single instanced PBR particle mesh with fixed typed-array state. Cosmetic
 * particles can be evicted only by a more important impact; active count never
 * exceeds PARTICLE_HARD_CAP.
 */
export class ParticleManager {
  constructor({ scene, registry = null, maxParticles = PARTICLE_HARD_CAP } = {}) {
    this.capacity = Math.max(1, Math.min(PARTICLE_HARD_CAP, Math.floor(maxParticles)));
    this.registry = registry;
    this.geometry = new THREE.IcosahedronGeometry(0.075, 1);
    this.material = createStandardMaterial({
      name: 'pooled-particle-pbr',
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.8,
      roughness: 0.36,
      metalness: 0.2,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    }, registry);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.name = 'pooled-particle-field';
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    scene?.add(this.mesh);
    registry?.track(this.geometry);
    registry?.trackObject(this.mesh);

    this.active = new Int16Array(this.capacity);
    this.activeIndex = new Int16Array(this.capacity);
    this.free = new Int16Array(this.capacity);
    this.alive = new Uint8Array(this.capacity);
    this.priority = new Float32Array(this.capacity);
    this.age = new Float32Array(this.capacity);
    this.life = new Float32Array(this.capacity);
    this.position = new Float32Array(this.capacity * 3);
    this.velocity = new Float32Array(this.capacity * 3);
    this.size = new Float32Array(this.capacity);
    this.color = new Float32Array(this.capacity * 3);
    this.activeCount = 0;
    this.freeCount = this.capacity;
    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._scale = new THREE.Vector3();
    this._color = new THREE.Color();
    for (let index = 0; index < this.capacity; index += 1) {
      this.free[index] = this.capacity - index - 1;
      this.activeIndex[index] = -1;
      this._hide(index);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawnBurst(recipe) {
    if (!recipe?.count) return 0;
    let spawned = 0;
    for (let index = 0; index < recipe.count; index += 1) {
      const slot = this._acquire(recipe.priority ?? 0);
      if (slot === -1) break;
      const angle = random() * Math.PI * 2;
      const radial = Math.sqrt(random()) * (recipe.spread ?? 0.5);
      const vertical = (random() - 0.5) * (recipe.spread ?? 0.5);
      const vectorIndex = slot * 3;
      this.position[vectorIndex] = recipe.x ?? 0;
      this.position[vectorIndex + 1] = recipe.y ?? 0;
      this.position[vectorIndex + 2] = recipe.z ?? 0;
      const speed = (recipe.speed ?? 4) * (0.45 + random() * 0.9);
      this.velocity[vectorIndex] = Math.cos(angle) * speed * (0.55 + radial);
      this.velocity[vectorIndex + 1] = Math.sin(angle) * speed * (0.55 + radial) + vertical;
      this.velocity[vectorIndex + 2] = (random() - 0.5) * speed * 0.35;
      this.age[slot] = 0;
      this.life[slot] = Math.max(0.04, (recipe.life ?? 0.6) * (0.7 + random() * 0.55));
      this.priority[slot] = recipe.priority ?? 0;
      this.size[slot] = (recipe.size ?? 0.12) * (0.65 + random() * 0.9);
      this._color.setHex(recipe.color ?? 0xffffff);
      this.color[vectorIndex] = this._color.r;
      this.color[vectorIndex + 1] = this._color.g;
      this.color[vectorIndex + 2] = this._color.b;
      this.mesh.setColorAt(slot, this._color);
      spawned += 1;
    }
    if (spawned > 0) this.mesh.instanceColor.needsUpdate = true;
    return spawned;
  }

  update(delta) {
    const safeDelta = Math.max(0, Math.min(0.1, delta || 0));
    let matricesChanged = false;
    for (let denseIndex = this.activeCount - 1; denseIndex >= 0; denseIndex -= 1) {
      const slot = this.active[denseIndex];
      const vectorIndex = slot * 3;
      this.age[slot] += safeDelta;
      if (this.age[slot] >= this.life[slot]) {
        this._release(slot);
        matricesChanged = true;
        continue;
      }
      this.velocity[vectorIndex + 1] -= 7 * safeDelta;
      this.position[vectorIndex] += this.velocity[vectorIndex] * safeDelta;
      this.position[vectorIndex + 1] += this.velocity[vectorIndex + 1] * safeDelta;
      this.position[vectorIndex + 2] += this.velocity[vectorIndex + 2] * safeDelta;
      const normalizedAge = this.age[slot] / this.life[slot];
      const currentScale = this.size[slot] * (1 - normalizedAge * normalizedAge);
      this._position.set(
        this.position[vectorIndex],
        this.position[vectorIndex + 1],
        this.position[vectorIndex + 2],
      );
      this._scale.setScalar(Math.max(0.001, currentScale));
      this._matrix.compose(this._position, IDENTITY_QUATERNION, this._scale);
      this.mesh.setMatrixAt(slot, this._matrix);
      matricesChanged = true;
    }
    if (matricesChanged) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    while (this.activeCount > 0) this._release(this.active[this.activeCount - 1]);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  stats() {
    return { active: this.activeCount, capacity: this.capacity, hardCap: PARTICLE_HARD_CAP };
  }

  dispose() {
    this.clear();
    this.registry?.untrack(this.mesh);
    this.registry?.untrack(this.geometry);
    this.registry?.untrack(this.material);
    this.mesh.parent?.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }

  _acquire(priority) {
    if (this.freeCount > 0) {
      const slot = this.free[--this.freeCount];
      this.alive[slot] = 1;
      this.activeIndex[slot] = this.activeCount;
      this.active[this.activeCount++] = slot;
      return slot;
    }
    let candidate = -1;
    let lowestPriority = priority;
    for (let index = 0; index < this.activeCount; index += 1) {
      const slot = this.active[index];
      if (this.priority[slot] < lowestPriority) {
        lowestPriority = this.priority[slot];
        candidate = slot;
      }
    }
    if (candidate === -1) return -1;
    this._release(candidate);
    return this._acquire(priority);
  }

  _release(slot) {
    if (!this.alive[slot]) return;
    const denseIndex = this.activeIndex[slot];
    const finalSlot = this.active[this.activeCount - 1];
    this.active[denseIndex] = finalSlot;
    this.activeIndex[finalSlot] = denseIndex;
    this.activeCount -= 1;
    this.activeIndex[slot] = -1;
    this.alive[slot] = 0;
    this.free[this.freeCount++] = slot;
    this._hide(slot);
  }

  _hide(slot) {
    this._matrix.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(slot, this._matrix);
  }
}

const IDENTITY_QUATERNION = new THREE.Quaternion();
let randomState = 0x8e4f20bd;
function random() {
  randomState += 0x6d2b79f5;
  let value = randomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
