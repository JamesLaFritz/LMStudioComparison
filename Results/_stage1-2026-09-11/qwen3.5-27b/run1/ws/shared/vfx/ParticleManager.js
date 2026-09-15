import { ObjectPool } from '../memory/ObjectPool.js';
import * as THREE from 'three';

class Particle {
  constructor() {
    this.mesh = null;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.lifetime = 0;
    this.maxLifetime = 1.0;
    this.color = new THREE.Color();
    this.scale = 1.0;
    this.active = false;
    
    // Initialize mesh with basic geometry
    const geometry = new THREE.PlaneGeometry(0.5, 0.5);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
  }
  
  init(position, color, velocitySpread) {
    this.position.copy(position);
    this.color.set(color);
    
    // Random velocity in all directions with spread
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 0.5 + 0.5) * velocitySpread;
    this.velocity.set(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      (Math.random() - 0.5) * velocitySpread * 0.5
    );
    
    // Add slight upward bias for explosions
    this.velocity.y += velocitySpread * 0.3;
    
    this.lifetime = 0.5 + Math.random() * 0.5;
    this.maxLifetime = this.lifetime;
    this.scale = 0.1 + Math.random() * 0.9;
    this.active = true;
    
    // Reset mesh state
    this.mesh.position.copy(this.position);
    this.mesh.material.color.copy(this.color);
    this.mesh.material.opacity = 1;
    this.mesh.visible = true;
    this.mesh.scale.setScalar(this.scale);
  }
  
  update(deltaTime) {
    if (!this.active) return false;
    
    this.lifetime -= deltaTime;
    
    // Update position based on velocity
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;
    
    // Apply gravity (slight downward pull)
    this.velocity.y -= 50 * deltaTime;
    
    // Update mesh
    this.mesh.position.copy(this.position);
    
    // Fade out based on lifetime ratio
    const lifeRatio = this.lifetime / this.maxLifetime;
    this.mesh.material.opacity = Math.max(0, lifeRatio);
    
    // Shrink over time
    this.mesh.scale.setScalar(this.scale * lifeRatio);
    
    return this.lifetime > 0;
  }
  
  isDead() {
    return this.lifetime <= 0 || !this.active;
  }
  
  reset() {
    this.active = false;
    this.mesh.visible = false;
  }
}

export class ParticleManager {
  constructor(maxParticles = 500) {
    this.maxCount = maxParticles;
    this.pool = new ObjectPool(Particle, maxParticles);
    this.activeParticles = [];
    
    // Pre-create all particles and add to scene (managed externally)
    this.particlesForScene = [];
  }
  
  attachToScene(scene) {
    // Add all pooled particles to scene initially hidden
    for (let i = 0; i < this.pool.size(); i++) {
      const particle = this.pool._slots[i];
      if (particle && particle.mesh) {
        scene.add(particle.mesh);
        this.particlesForScene.push(particle);
      }
    }
  }
  
  spawnBurst(position, color, count, velocitySpread = 100) {
    // Enforce hard cap - remove oldest particles if over limit
    while (this.activeParticles.length >= this.maxCount) {
      const oldParticle = this.activeParticles.shift();
      oldParticle.reset();
      this.pool.release(oldParticle);
    }
    
    for (let i = 0; i < count; i++) {
      // Check cap before spawning each particle
      if (this.activeParticles.length >= this.maxCount) break;
      
      const particle = this.pool.acquire();
      particle.init(position, color, velocitySpread);
      this.activeParticles.push(particle);
    }
  }
  
  spawnTrail(position, color, count = 3, velocitySpread = 20) {
    // Similar to burst but with lower spread for trail effects
    this.spawnBurst(position, color, count, velocitySpread);
  }
  
  update(deltaTime) {
    // Update all active particles and remove dead ones
    const surviving = [];
    
    for (const particle of this.activeParticles) {
      if (particle.update(deltaTime)) {
        surviving.push(particle);
      } else {
        particle.reset();
        this.pool.release(particle);
      }
    }
    
    this.activeParticles = surviving;
  }
  
  getCount() {
    return this.activeParticles.length;
  }
  
  getMaxCount() {
    return this.maxCount;
  }
}

export { Particle };
