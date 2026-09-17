import * as THREE from 'three';
import { ObjectPool } from '@shared/core/ObjectPool.js';
import { clamp } from '@shared/math/Math2D.js';

const MAX_TRAIL_SEGMENTS = 192;

function createSegment() {
  return {
    age: 0,
    life: 0,
    x: 0,
    y: 0,
    z: 0,
    length: 0,
    color: 0xffffff,
  };
}

function resetSegment(segment) {
  segment.age = 0;
  segment.life = 0;
  segment.length = 0;
}

export class MotionTrailManager {
  constructor(parent, registry) {
    this.geometry = new THREE.CylinderGeometry(0.028, 0.055, 1, 6, 1, true);
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.9,
      metalness: 0.1,
      roughness: 0.18,
      transparent: true,
      opacity: 0.7,
      vertexColors: true,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_TRAIL_SEGMENTS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.pool = new ObjectPool(MAX_TRAIL_SEGMENTS, createSegment, resetSegment);
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.color = new THREE.Color();
    parent.add(this.mesh);
    for (let index = 0; index < MAX_TRAIL_SEGMENTS; index += 1) {
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

  _write(segment) {
    const fade = 1 - clamp(segment.age / segment.life, 0, 1);
    this.position.set(segment.x, segment.y, segment.z);
    this.scale.set(fade, Math.max(0.001, segment.length * fade), fade);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.mesh.setMatrixAt(segment.__poolIndex, this.matrix);
    this.color.setHex(segment.color).multiplyScalar(fade);
    this.mesh.setColorAt(segment.__poolIndex, this.color);
  }

  captureProjectile(projectile) {
    if (!projectile.trailPending || !projectile.__poolActive) {
      return;
    }
    projectile.trailPending = false;
    const segment = this.pool.acquire();
    if (!segment) {
      return;
    }
    segment.age = 0;
    segment.life = 0.18;
    segment.x = projectile.x;
    segment.y = (projectile.previousY + projectile.y) * 0.5;
    segment.z = projectile.owner === 'player' ? 0.18 : 0.11;
    segment.length = Math.max(0.09, Math.abs(projectile.y - projectile.previousY) * 0.6);
    segment.color = projectile.tint;
    this._write(segment);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(delta) {
    let dirty = false;
    for (let index = 0; index < this.pool.capacity; index += 1) {
      if (!this.pool.isActive(index)) {
        continue;
      }
      const segment = this.pool.itemAt(index);
      segment.age += delta;
      if (segment.age >= segment.life) {
        this._hide(index);
        this.pool.release(segment);
      } else {
        this._write(segment);
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
