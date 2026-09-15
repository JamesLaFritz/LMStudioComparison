import * as THREE from 'three';
import { clamp, randRange } from 'shared/math/MathUtils.js';

export class ParticleManager {
  constructor(scene, maxCount = 500) {
    this.scene = scene;
    this.maxCount = maxCount;
    this.activeCount = 0;

    // Particle data arrays (SoA for cache friendliness)
    this.positions = new Float32Array(maxCount * 3);
    this.velocities = new Float32Array(maxCount * 3);
    this.lifetimes = new Float32Array(maxCount); // remaining life in seconds
    this.maxLifetimes = new Float32Array(maxCount); // total lifetime for fade calc
    this.sizes = new Float32Array(maxCount);
    this.alive = new Uint8Array(maxCount); // 0 or 1

    // InstancedMesh for all particles
    const geometry = new THREE.SphereGeometry(0.08, 4, 4);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.0,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Per-instance color
    this.colors = new Float32Array(maxCount * 3);
    const colorAttr = new THREE.InstancedBufferAttribute(this.colors, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = colorAttr;

    this._dummy = new THREE.Object3D();
    this._tempColor = new THREE.Color();
    this._matrixArray = new Float32Array(maxCount * 16);

    scene.add(this.mesh);

    // Track for disposal
    this.geometry = geometry;
    this.material = material;
  }

  emit(config) {
    const {
      position, count, color, spread = 2, speedMin = 1, speedMax = 4,
      lifetimeMin = 0.3, lifetimeMax = 1.0, sizeMin = 0.05, sizeMax = 0.15,
      gravity = 0,
    } = config;

    let emitted = 0;
    const c = new THREE.Color(color);

    for (let i = 0; i < this.maxCount && emitted < count; i++) {
      if (this.alive[i]) continue;

      const i3 = i * 3;
      this.alive[i] = 1;
      this.positions[i3] = position.x;
      this.positions[i3 + 1] = position.y;
      this.positions[i3 + 2] = position.z;

      // Random velocity in a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = randRange(speedMin, speedMax);
      this.velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed;
      this.velocities[i3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      this.velocities[i3 + 2] = Math.cos(phi) * speed;

      this.lifetimes[i] = randRange(lifetimeMin, lifetimeMax);
      this.maxLifetimes[i] = this.lifetimes[i];
      this.sizes[i] = randRange(sizeMin, sizeMax);

      // Color with slight variation
      const variation = 0.15;
      this.colors[i3] = clamp(c.r + randRange(-variation, variation), 0, 1);
      this.colors[i3 + 1] = clamp(c.g + randRange(-variation, variation), 0, 1);
      this.colors[i3 + 2] = clamp(c.b + randRange(-variation, variation), 0, 1);

      emitted++;
      this.activeCount++;
    }
    return emitted;
  }

  burst(position, count, color, spread = 2, speed = 3) {
    return this.emit({
      position, count, color, spread,
      speedMin: speed * 0.5, speedMax: speed * 1.5,
      lifetimeMin: 0.4, lifetimeMax: 1.0,
      sizeMin: 0.06, sizeMax: 0.14,
      gravity: -2,
    });
  }

  spark(position, count, color) {
    return this.emit({
      position, count, color,
      speedMin: 3, speedMax: 7,
      lifetimeMin: 0.15, lifetimeMax: 0.4,
      sizeMin: 0.03, sizeMax: 0.08,
      gravity: -4,
    });
  }

  explosion(position, count, color, radius = 3) {
    return this.emit({
      position, count, color,
      speedMin: radius * 0.5, speedMax: radius * 2,
      lifetimeMin: 0.5, lifetimeMax: 1.5,
      sizeMin: 0.08, sizeMax: 0.2,
      gravity: -1,
    });
  }

  update(dt) {
    let currentActive = 0;

    for (let i = 0; i < this.maxCount; i++) {
      if (!this.alive[i]) continue;

      this.lifetimes[i] -= dt;
      if (this.lifetimes[i] <= 0) {
        this.alive[i] = 0;
        // Hide instance by scaling to 0
        this._dummy.position.set(0, 0, 0);
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }

      currentActive++;
      const i3 = i * 3;

      // Update velocity (gravity)
      this.velocities[i3 + 1] += -2 * dt; // default gravity

      // Update position
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;

      // Fade and shrink
      const lifeRatio = this.lifetimes[i] / this.maxLifetimes[i];
      const scale = this.sizes[i] * lifeRatio;

      this._dummy.position.set(
        this.positions[i3],
        this.positions[i3 + 1],
        this.positions[i3 + 2]
      );
      this._dummy.scale.set(scale, scale, scale);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);

      // Fade color
      this.colors[i3] *= 0.98;
      this.colors[i3 + 1] *= 0.98;
      this.colors[i3 + 2] *= 0.98;
    }

    this.activeCount = currentActive;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }

  reset() {
    for (let i = 0; i < this.maxCount; i++) {
      this.alive[i] = 0;
      this.lifetimes[i] = 0;
      this._dummy.position.set(0, 0, 0);
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.activeCount = 0;
  }
}
