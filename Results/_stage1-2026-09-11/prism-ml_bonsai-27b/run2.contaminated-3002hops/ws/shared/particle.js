/**
 * ParticleManager — Centralized particle system with hard 500-particle cap.
 * Uses object pooling to prevent GC pressure. All particles are pooled and reused.
 */

import { vec3 } from '../utils/math.js';

export class ParticleManager {
  constructor(maxParticles = 500) {
    this.maxParticles = maxParticles;
    this.particles = []; // Pool of particle data objects
    this.geometry = null;
    this.material = null;
    this.mesh = null;
    this._initGeometry();
  }

  /**
   * Initialize the InstancedMesh and material for rendering all particles.
   */
  _initGeometry() {
    // Create a simple square geometry (particle shape)
    const positions = new Float32Array([
      -0.1, 0, 0.1,
       0.1, 0, 0.1,
       0.1, 0, -0.1,
      -0.1, 0, -0.1,
    ]);

    const indices = new Uint32Array([
      0, 1, 2,
      0, 2, 3,
    ]);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setIndex(indices);

    // Material with emissive glow for neon particles
    this.material = new THREE.MeshStandardMaterial({
      color: 0x00ffaa,
      emissive: 0x00ffaa,
      emissiveIntensity: 1.5,
      metalness: 0,
      roughness: 0.3,
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material);
    this.mesh.visible = false; // Will be toggled when particles exist
  }

  /**
   * Spawn a burst of particles at a given position.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   * @param {string} color - Hex color for the particle (e.g., '0x00ffaa')
   * @param {number} count - Number of particles to spawn (max 500)
   */
  spawn(x, y, z, color, count = 20) {
    const available = this.maxParticles - this.particles.length;
    const toSpawn = Math.min(count, available);

    for (let i = 0; i < toSpawn; i++) {
      const p = this.particles[i];
      // Random spread around the spawn point
      p.x = x + (Math.random() - 0.5) * 0.3;
      p.y = y + (Math.random() - 0.5) * 0.3;
      p.z = z + (Math.random() - 0.5) * 0.3;

      // Random velocity with some spread
      const speed = 100 + Math.random() * 400;
      p.vx = (Math.random() - 0.5) * speed;
      p.vy = (Math.random() - 0.5) * speed;
      p.vz = (Math.random() - 0.5) * speed * 0.5;

      // Lifetime: 0.4 to 1.2 seconds
      p.life = 0.6 + Math.random() * 0.6;
      p.maxLife = p.life;
      p.color = color;
    }

    this._updateInstances();
    if (!this.mesh.visible) {
      this.mesh.visible = true;
    }
  }

  /**
   * Update all particles by their velocity and lifetime.
   * Expired particles are recycled to the end of the pool.
   */
  update(dt) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;

      // Apply velocity with damping
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Exponential fade based on lifetime
      p.life -= dt;
    }

    this._updateInstances();
  }

  /**
   * Update the InstancedMesh positions and colors to match particle data.
   */
  _updateInstances() {
    const count = this.particles.length;
    if (count === 0) return;

    // Build position array for instanced mesh
    const positions = new Float32Array(count * 3);
    const colors = new Uint8Array(count * 4); // RGBA

    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      const r = parseInt(p.color.slice(1, 3), 16) / 255;
      const g = parseInt(p.color.slice(3, 5), 16) / 255;
      const b = parseInt(p.color.slice(5, 7), 16) / 255;

      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;

      colors[i * 4] = r * 255 | 0;
      colors[i * 4 + 1] = g * 255 | 0;
      colors[i * 4 + 2] = b * 255 | 0;
      colors[i * 4 + 3] = p.life * 255 | 0; // Alpha based on life
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.material.color.setFromRGB(colors);
  }

  /**
   * Dispose all resources to prevent memory leaks.
   */
  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
    if (this.mesh) {
      this.mesh.visible = false;
      this.mesh.dispose();
    }
    this.particles.length = 0;
  }

  /**
   * Get the mesh for adding to a Three.js scene.
   */
  getMesh() {
    return this.mesh;
  }
}