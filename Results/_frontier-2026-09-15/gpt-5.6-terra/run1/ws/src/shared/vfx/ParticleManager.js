import * as THREE from 'three';
import { ObjectPool } from '@shared/core/ObjectPool.js';
import { clamp } from '@shared/math/Math2D.js';

export const MAX_PARTICLES = 500;

function createParticle() {
  return {
    age: 0,
    life: 0,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    scale: 0,
    color: 0xffffff,
    priority: 0,
    drag: 0,
  };
}

function resetParticle(particle) {
  particle.age = 0;
  particle.life = 0;
  particle.scale = 0;
  particle.priority = 0;
}

export class ParticleManager {
  constructor(parent, registry) {
    this.geometry = new THREE.TetrahedronGeometry(0.11, 0);
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.65,
      metalness: 0.08,
      roughness: 0.22,
      transparent: true,
      opacity: 0.94,
      vertexColors: true,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.pool = new ObjectPool(MAX_PARTICLES, createParticle, resetParticle);
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.euler = new THREE.Euler();
    this.color = new THREE.Color();
    this.phase = 0;
    parent.add(this.mesh);
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      this._hide(index);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    registry.add(() => this.dispose());
  }

  _hide(index) {
    this.scale.set(0, 0, 0);
    this.matrix.compose(this.position.set(0, -100, 0), this.quaternion, this.scale);
    this.mesh.setMatrixAt(index, this.matrix);
  }

  _setParticle(particle) {
    const progress = clamp(particle.age / particle.life, 0, 1);
    const visualScale = Math.max(0.001, particle.scale * (1 - progress) ** 0.65);
    this.position.set(particle.x, particle.y, particle.z);
    this.scale.set(visualScale, visualScale, visualScale);
    this.quaternion.setFromEuler(this.euler.set(particle.age * 8, particle.age * 4, particle.age * 6));
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.mesh.setMatrixAt(particle.__poolIndex, this.matrix);
    this.color.setHex(particle.color).multiplyScalar(1 - progress * 0.72);
    this.mesh.setColorAt(particle.__poolIndex, this.color);
  }

  _acquire(priority) {
    let particle = this.pool.acquire();
    if (particle) {
      return particle;
    }
    let candidate = null;
    for (let index = 0; index < this.pool.capacity; index += 1) {
      if (!this.pool.isActive(index)) {
        continue;
      }
      const current = this.pool.itemAt(index);
      if (
        current.priority < priority
        && (!candidate || current.priority < candidate.priority || current.age / current.life > candidate.age / candidate.life)
      ) {
        candidate = current;
      }
    }
    if (!candidate) {
      return null;
    }
    this._hide(candidate.__poolIndex);
    this.pool.release(candidate);
    return this.pool.acquire();
  }

  burst(x, y, z, count, color, severity = 0.3, priority = 1) {
    const cappedCount = Math.min(count, MAX_PARTICLES);
    for (let index = 0; index < cappedCount; index += 1) {
      const particle = this._acquire(priority);
      if (!particle) {
        break;
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.8 + Math.random() * 2.2) * (0.5 + severity);
      particle.age = 0;
      particle.life = 0.22 + Math.random() * 0.42 + severity * 0.15;
      particle.x = x;
      particle.y = y;
      particle.z = z + (Math.random() - 0.5) * 0.28;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed + severity * 1.4;
      particle.vz = (Math.random() - 0.5) * speed * 0.45;
      particle.scale = 0.035 + Math.random() * 0.07 + severity * 0.05;
      particle.color = color;
      particle.priority = priority;
      particle.drag = 2.2 + Math.random() * 2.8;
      this._setParticle(particle);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  update(delta) {
    let dirtyMatrix = false;
    let dirtyColor = false;
    for (let index = 0; index < this.pool.capacity; index += 1) {
      if (!this.pool.isActive(index)) {
        continue;
      }
      const particle = this.pool.itemAt(index);
      particle.age += delta;
      if (particle.age >= particle.life) {
        this._hide(index);
        this.pool.release(particle);
        dirtyMatrix = true;
        continue;
      }
      particle.vy -= 2.7 * delta;
      const decay = Math.exp(-particle.drag * delta);
      particle.vx *= decay;
      particle.vy *= decay;
      particle.vz *= decay;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.z += particle.vz * delta;
      this._setParticle(particle);
      dirtyMatrix = true;
      dirtyColor = true;
    }
    if (dirtyMatrix) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    if (dirtyColor && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  get activeCount() {
    return this.pool.activeCount;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
