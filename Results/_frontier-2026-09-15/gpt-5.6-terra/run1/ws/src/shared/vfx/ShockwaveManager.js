import * as THREE from 'three';
import { ObjectPool } from '@shared/core/ObjectPool.js';
import { clamp } from '@shared/math/Math2D.js';

const MAX_SHOCKWAVES = 16;

function createShockwave() {
  return {
    age: 0,
    life: 0,
    x: 0,
    y: 0,
    z: 0,
    radius: 0,
    expansion: 0,
    color: 0xffffff,
    priority: 0,
  };
}

function resetShockwave(shockwave) {
  shockwave.age = 0;
  shockwave.life = 0;
  shockwave.radius = 0;
}

export class ShockwaveManager {
  constructor(parent, registry) {
    this.geometry = new THREE.TorusGeometry(1, 0.045, 6, 40);
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.5,
      metalness: 0.16,
      roughness: 0.26,
      transparent: true,
      opacity: 0.74,
      vertexColors: true,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_SHOCKWAVES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.pool = new ObjectPool(MAX_SHOCKWAVES, createShockwave, resetShockwave);
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.color = new THREE.Color();
    parent.add(this.mesh);
    for (let index = 0; index < MAX_SHOCKWAVES; index += 1) {
      this._hide(index);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    registry.add(() => this.dispose());
  }

  _hide(index) {
    this.position.set(0, -100, 0);
    this.scale.set(0, 0, 0);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.mesh.setMatrixAt(index, this.matrix);
  }

  _write(shockwave) {
    const progress = clamp(shockwave.age / shockwave.life, 0, 1);
    const radius = shockwave.radius + shockwave.expansion * shockwave.age;
    const fade = 1 - progress;
    this.position.set(shockwave.x, shockwave.y, shockwave.z);
    this.scale.set(radius, radius, radius);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.mesh.setMatrixAt(shockwave.__poolIndex, this.matrix);
    this.color.setHex(shockwave.color).multiplyScalar(fade);
    this.mesh.setColorAt(shockwave.__poolIndex, this.color);
  }

  spawn(x, y, z, color, severity = 0.35, priority = 1) {
    let wave = this.pool.acquire();
    if (!wave) {
      let candidate = null;
      for (let index = 0; index < this.pool.capacity; index += 1) {
        if (!this.pool.isActive(index)) continue;
        const current = this.pool.itemAt(index);
        if (!candidate || current.priority < candidate.priority) candidate = current;
      }
      if (!candidate || candidate.priority > priority) return;
      this._hide(candidate.__poolIndex);
      this.pool.release(candidate);
      wave = this.pool.acquire();
    }
    wave.age = 0;
    wave.life = 0.28 + severity * 0.22;
    wave.x = x;
    wave.y = y;
    wave.z = z;
    wave.radius = 0.16 + severity * 0.1;
    wave.expansion = 2.8 + severity * 3.6;
    wave.color = color;
    wave.priority = priority;
    this._write(wave);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(delta) {
    let dirty = false;
    for (let index = 0; index < this.pool.capacity; index += 1) {
      if (!this.pool.isActive(index)) continue;
      const wave = this.pool.itemAt(index);
      wave.age += delta;
      if (wave.age >= wave.life) {
        this._hide(index);
        this.pool.release(wave);
      } else {
        this._write(wave);
      }
      dirty = true;
    }
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
