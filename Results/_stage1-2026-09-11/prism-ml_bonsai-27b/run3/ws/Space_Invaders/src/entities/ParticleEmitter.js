import * as THREE from 'three';
import { MeshStandardMaterial, MeshBasicMaterial } from 'three';
import { Pool } from '../../shared/utils/Pool.js';

/**
 * ParticleEmitter - Single particle emitter for explosion effects.
 * Emits particles in a cone pattern with configurable speed and spread.
 */

class ParticleEmitter {
  constructor(scene, renderer, options = {}) {
    this.scene = scene;
    this.renderer = renderer;

    // Emitter configuration
    this.position = new THREE.Vector3(0, 0, 0);
    this.color = 0x00ffaa;
    this.speed = 100;
    this.count = 5;
    this.spreadAngle = Math.PI / 2; // Spread angle in radians
    this.lifetime = 1.0;

    // Particle pool for emitted particles
    this.pool = new Pool(30);
    this.activeParticles = [];

    // Create particle mesh template
    this.particleGeometry = new THREE.SphereGeometry(0.05, 8, 6);
    this.particleMaterial = new MeshBasicMaterial({ color: this.color });
    this.particleMesh = new THREE.Mesh(this.particleGeometry, this.particleMaterial);

    // Create particle pool mesh (shared)
    const sharedMesh = new THREE.Mesh(
      this.particleGeometry.clone(),
      this.particleMaterial.clone()
    );
    this.scene.add(sharedMesh);

    // Store options for reuse
    this.options = { ...options };
  }

  emit(x, y, z, count = null) {
    const c = count || this.count;
    for (let i = 0; i < c; i++) {
      const particle = this.allocateParticle();
      if (!particle) continue;

      // Random direction within spread cone
      const angle = Math.random() * this.spreadAngle;
      const elevation = (Math.random() - 0.5) * Math.PI / 2;
      const speedMult = 0.5 + Math.random() * 0.5;

      particle.velocity.set(
        Math.cos(angle) * Math.sin(elevation) * this.speed * speedMult,
        Math.cos(elevation) * this.speed * speedMult,
        Math.sin(angle) * Math.sin(elevation) * this.speed * speedMult
      );

      particle.life = 0.5 + Math.random() * (this.lifetime - 0.5);
      particle.maxLife = particle.life;
      particle.active = true;

      // Add to active list
      if (this.activeParticles.length < 100) {
        this.activeParticles.push(particle);
      }
    }
  }

  allocateParticle() {
    const item = this.pool.acquire((item) => {
      const p = new THREE.ObjectData();
      p.position = new THREE.Vector3(0, 0, 0);
      p.velocity = new THREE.Vector3(0, 0, 0);
      p.life = 1.0;
      p.maxLife = 1.0;
      p.active = true;

      item.mesh = this.particleMesh.clone();
      item.data = p;
      return item;
    });

    if (item) {
      this.scene.add(item.mesh);
    }

    return item;
  }

  update(deltaTime) {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      if (!p || !p.active) continue;

      // Update position
      p.data.position.add(p.data.velocity * deltaTime);

      // Decrease life
      p.data.life -= deltaTime;

      // Fade out as particle dies
      const alpha = Math.max(0, p.data.life / p.data.maxLife);
      if (p.mesh.material) {
        p.mesh.material.opacity = alpha;
      }

      // Remove when dead
      if (p.data.life <= 0) {
        this.returnToPool(p);
        this.activeParticles.splice(i, 1);
      }
    }
  }

  returnToPool(particle) {
    const item = this.pool.release(particle);
    if (item) {
      this.scene.remove(item.mesh);
      item.mesh.position.set(0, 0, 0);
      item.data.life = 1.0;
      item.data.maxLife = 1.0;
      item.active = true;
    }
  }

  clear() {
    for (const p of this.activeParticles) {
      this.returnToPool(p);
    }
    this.activeParticles = [];
  }

  dispose() {
    this.clear();
    this.pool.clear();
    if (this.particleMesh && this.scene) {
      this.scene.remove(this.particleMesh);
      this.particleMesh.dispose();
    }
  }
}

export default ParticleEmitter;