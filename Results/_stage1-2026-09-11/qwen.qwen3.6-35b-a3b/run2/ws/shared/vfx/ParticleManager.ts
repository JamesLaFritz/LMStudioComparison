import * as THREE from 'three';
import type { Vector3f } from '../types.js';

const MAX_PARTICLES = 500;

interface ParticleConfig {
  position: Vector3f;
  velocity: Vector3f;
  color: number;
  size: number;
  life: number;
}

export class ParticleManager {
  private particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private activeCount: number = 0;
  private maxCapacity: number;

  constructor(scene: THREE.Scene, color: THREE.Color = new THREE.Color(0x00ffff)) {
    const geometry = new THREE.BufferGeometry();
    this.maxCapacity = MAX_PARTICLES;
    this.positions = new Float32Array(this.maxCapacity * 3);
    this.colors = new Float32Array(this.maxCapacity * 3);
    this.sizes = new Float32Array(this.maxCapacity);
    this.velocities = new Float32Array(this.maxCapacity * 3);
    this.lifetimes = new Float32Array(this.maxCapacity);

    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(geometry, material);
    scene.add(this.particles);
  }

  spawn(config: ParticleConfig): void {
    if (this.activeCount >= this.maxCapacity) return;

    const idx = this.activeCount;
    this.positions[idx * 3] = config.position.x;
    this.positions[idx * 3 + 1] = config.position.y;
    this.positions[idx * 3 + 2] = config.position.z || 0;

    this.velocities[idx * 3] = config.velocity.x;
    this.velocities[idx * 3 + 1] = config.velocity.y;
    this.velocities[idx * 3 + 2] = config.velocity.z || 0;

    const c = new THREE.Color(config.color);
    this.colors[idx * 3] = c.r;
    this.colors[idx * 3 + 1] = c.g;
    this.colors[idx * 3 + 2] = c.b;

    this.sizes[idx] = config.size;
    this.lifetimes[idx] = config.life;

    this.activeCount++;
  }

  update(dt: number): void {
    const geometry = this.particles.geometry as THREE.BufferGeometry;
    for (let i = this.activeCount - 1; i >= 0; i--) {
      this.lifetimes[i] -= dt;
      if (this.lifetimes[i] <= 0) {
        // Swap with last active particle
        const lastIdx = this.activeCount - 1;
        if (i !== lastIdx) {
          this.positions[i * 3] = this.positions[lastIdx * 3];
          this.positions[i * 3 + 1] = this.positions[lastIdx * 3 + 1];
          this.positions[i * 3 + 2] = this.positions[lastIdx * 3 + 2];
          this.velocities[i * 3] = this.velocities[lastIdx * 3];
          this.velocities[i * 3 + 1] = this.velocities[lastIdx * 3 + 1];
          this.velocities[i * 3 + 2] = this.velocities[lastIdx * 3 + 2];
          this.colors[i * 3] = this.colors[lastIdx * 3];
          this.colors[i * 3 + 1] = this.colors[lastIdx * 3 + 1];
          this.colors[i * 3 + 2] = this.colors[lastIdx * 3 + 2];
          this.sizes[i] = this.sizes[lastIdx];
          this.lifetimes[i] = this.lifetimes[lastIdx];
        }
        this.activeCount--;
      } else {
        // Update position with velocity and gravity
        const lifeRatio = this.lifetimes[i] / Math.max(0.01, this.sizes[i]);
        this.positions[i * 3] += this.velocities[i * 3] * dt;
        this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt - 2.0 * dt;
        // Fade color based on remaining life
        const fade = Math.max(0, lifeRatio);
        this.colors[i * 3] *= (0.95 + 0.05 * fade);
        this.colors[i * 3 + 1] *= (0.95 + 0.05 * fade);
        this.colors[i * 3 + 2] *= (0.95 + 0.05 * fade);
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }

  get particleSystem(): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
    return this.particles;
  }

  dispose(): void {
    const geometry = this.particles.geometry as THREE.BufferGeometry;
    geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
    this.particles.clearGroups();
  }
}
