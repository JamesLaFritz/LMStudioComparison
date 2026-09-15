import * as THREE from 'three';
import { randRange } from '../utils/Math.js';

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Centralized particle system. ONE InstancedMesh, hard-capped at `max` live
 * particles (default 500). Zero per-frame allocation: velocity, color, size,
 * and life are pre-allocated typed arrays; the free list is an index stack.
 *
 * When the pool is near its cap, low-priority spawns are rejected so the cap
 * is never exceeded: priority 3 always accepted, 2 accepted until 92% full,
 * 1 accepted until 80% full.
 */
export class ParticleManager {
  constructor(scene, { max = 500 } = {}) {
    this.max = max;
    this.scene = scene;

    this.positions = new Float32Array(max * 3);
    this.velocities = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    this.sizes = new Float32Array(max);
    this.lives = new Float32Array(max);
    this.maxLives = new Float32Array(max);
    this.gravities = new Float32Array(max);
    this.free = new Int32Array(max);
    this.freeCount = max;
    this.liveCount = 0;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.4,
      roughness: 0.4,
      metalness: 0.0,
      toneMapped: false,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this._tmpMatrix = new THREE.Matrix4();
    this._tmpColor = new THREE.Color();
    for (let i = 0; i < max; i++) {
      this.free[i] = max - 1 - i;
      this.mesh.setMatrixAt(i, HIDDEN);
      this.mesh.setColorAt(i, this._tmpColor.setRGB(1, 1, 1));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }

  /**
   * Spawn a burst. All parameters optional; see defaults below.
   * @returns {number} number of particles actually spawned (0 if rejected)
   */
  burst({
    position,
    count = 20,
    colors = [0xffffff],
    speed = [2, 8],
    spread = 1,
    gravity = -6,
    life = [0.4, 0.9],
    size = [0.06, 0.16],
    priority = 1,
  } = {}) {
    const threshold = priority >= 3 ? 1.0 : priority >= 2 ? 0.92 : 0.8;
    const budget = Math.floor(this.max * threshold);
    let spawned = 0;
    for (let n = 0; n < count; n++) {
      if (this.freeCount === 0 || this.liveCount >= budget) break;
      const i = this.free[--this.freeCount];
      this.liveCount++;
      spawned++;

      const i3 = i * 3;
      this.positions[i3] = position.x;
      this.positions[i3 + 1] = position.y;
      this.positions[i3 + 2] = position.z;

      // Uniform direction on a sphere, flattened by `spread` on x/z.
      const theta = Math.random() * Math.PI * 2;
      const cosPhi = Math.random() * 2 - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      const dirX = sinPhi * Math.cos(theta) * spread;
      const dirY = cosPhi;
      const dirZ = sinPhi * Math.sin(theta) * spread;
      const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;
      const v = randRange(speed[0], speed[1]);
      this.velocities[i3] = (dirX / len) * v;
      this.velocities[i3 + 1] = (dirY / len) * v;
      this.velocities[i3 + 2] = (dirZ / len) * v;

      const c = colors[(Math.random() * colors.length) | 0];
      this._tmpColor.set(c);
      this.colors[i3] = this._tmpColor.r;
      this.colors[i3 + 1] = this._tmpColor.g;
      this.colors[i3 + 2] = this._tmpColor.b;
      this.mesh.setColorAt(i, this._tmpColor);

      this.sizes[i] = randRange(size[0], size[1]);
      this.lives[i] = this.maxLives[i] = randRange(life[0], life[1]);
      this.gravities[i] = gravity;
    }
    if (spawned > 0 && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return spawned;
  }

  update(dt) {
    if (dt <= 0) return;
    const mesh = this.mesh;
    const drag = Math.exp(-2.2 * dt);
    let anyAlive = false;
    for (let i = 0; i < this.max; i++) {
      if (this.lives[i] <= 0) continue;
      anyAlive = true;
      this.lives[i] -= dt;
      const i3 = i * 3;
      if (this.lives[i] <= 0) {
        this.free[this.freeCount++] = i;
        this.liveCount--;
        mesh.setMatrixAt(i, HIDDEN);
        continue;
      }
      this.velocities[i3 + 1] += this.gravities[i] * dt;
      this.velocities[i3] *= drag;
      this.velocities[i3 + 1] *= drag;
      this.velocities[i3 + 2] *= drag;
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;

      const t = this.lives[i] / this.maxLives[i];
      const s = this.sizes[i] * (0.25 + 0.75 * t);
      this._tmpMatrix.makeScale(s, s, s);
      this._tmpMatrix.setPosition(this.positions[i3], this.positions[i3 + 1], this.positions[i3 + 2]);
      mesh.setMatrixAt(i, this._tmpMatrix);
    }
    if (anyAlive) mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
