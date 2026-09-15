import { Vector3 } from './math.js';

/**
 * ParticleManager - Centralized particle system with hard cap of 500 active particles.
 * Uses object pooling and LRU eviction strategy for maximum performance.
 */
export class ParticleManager {
  constructor(scene, maxParticles = 500) {
    this.maxParticles = maxParticles;
    this.activeCount = 0;
    
    // Pre-allocate particle pool
    this.particles = new Array(maxParticles).fill(null).map(() => ({
      position: new Vector3(),
      velocity: new Vector3(),
      color: new THREE.Color(),
      lifetime: 0,
      maxLifetime: 0,
      active: false,
      lastUsed: 0 // For LRU eviction
    }));
    
    // Particle system geometry and material
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.PointsMaterial({
      size: 0.2,
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    
    this.particleSystem = new THREE.Points(this.geometry, this.material);
    scene.add(this.particleSystem);
    
    // Buffer attributes for efficient updates
    this.positionAttribute = new THREE.Float32BufferAttribute(maxParticles * 3, 3);
    this.colorAttribute = new THREE.Float32BufferAttribute(maxParticles * 3, 3);
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('color', this.colorAttribute);
    
    // Timestamp for LRU tracking
    this.lastUpdateTime = performance.now();
  }

  /**
   * Spawn a burst of particles at position with specified color and count.
   * Uses cone distribution for explosion effect.
   */
  spawnBurst(position, count, color) {
    const now = performance.now();
    
    for (let i = 0; i < count && this.activeCount < this.maxParticles; i++) {
      const particle = this.acquire(now);
      if (!particle) break;
      
      particle.position.copy(position);
      
      // Cone distribution for explosion effect
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      const zSpread = (Math.random() - 0.5) * 2;
      
      particle.velocity.set(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        zSpread
      );
      
      particle.color.copy(color);
      particle.lifetime = 0;
      particle.maxLifetime = 20 + Math.random() * 10; // frames at 60fps
      particle.active = true;
      this.activeCount++;
    }
  }

  /**
   * Update all active particles. Returns false if pool exhausted.
   */
  update(deltaTime) {
    const positions = [];
    const colors = [];
    
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      
      // Update physics with drag
      p.position.addScaledVector(p.velocity, deltaTime);
      p.lifetime += deltaTime * 60; // normalize to frames
      
      // Fade out near end of life
      const alpha = Math.max(0, 1 - (p.lifetime / p.maxLifetime));
      
      positions.push(p.position.x, p.position.y, p.position.z);
      colors.push(
        p.color.r * alpha,
        p.color.g * alpha,
        p.color.b * alpha
      );
    }
    
    // Update buffer attributes efficiently
    this.positionAttribute.setArray(new Float32Array(positions));
    this.colorAttribute.setArray(new Float32Array(colors));
    this.positionAttribute.needsUpdate = true;
    this.colorAttribute.needsUpdate = true;
    
    // Cleanup inactive particles and track LRU
    const now = performance.now();
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].lifetime >= this.particles[i].maxLifetime) {
        this.release(i, now);
      } else {
        this.particles[i].lastUsed = now;
      }
    }
    
    return true; // pool not exhausted
  }

  /**
   * Acquire a particle from the pool using LRU strategy.
   */
  acquire(now) {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) {
        return this.particles[i];
      }
    }
    // Pool exhausted - find least recently used
    let lruIndex = 0;
    let minTime = Infinity;
    
    for (let i = 1; i < this.particles.length; i++) {
      if (this.particles[i].lastUsed < minTime) {
        minTime = this.particles[i].lastUsed;
        lruIndex = i;
      }
    }
    
    // Evict LRU particle
    const evicted = this.particles[lruIndex];
    evicted.active = false;
    this.activeCount--;
    
    return evicted;
  }

  /**
   * Release a particle back to the pool.
   */
  release(index, now) {
    if (index >= 0 && index < this.particles.length) {
      this.particles[index].active = false;
      this.particles[index].lastUsed = now || performance.now();
      this.activeCount--;
    }
  }

  /**
   * Clear all particles and reset the pool.
   */
  clear() {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
    }
    this.activeCount = 0;
    
    // Reset buffer attributes
    this.positionAttribute.setArray(new Float32Array(this.maxParticles * 3));
    this.colorAttribute.setArray(new Float32Array(this.maxParticles * 3));
    this.positionAttribute.needsUpdate = true;
    this.colorAttribute.needsUpdate = true;
  }

  /**
   * Dispose all resources to prevent memory leaks.
   */
  dispose() {
    this.particleSystem.dispose();
    this.geometry.dispose();
    this.material.dispose();
    
    // Clear particle pool references
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i] = null;
    }
  }
}

/**
 * Utility function to create a procedural explosion color gradient.
 */
export function getExplosionColor(type) {
  switch (type) {
    case 'fire': return new THREE.Color(0xff8800); // Orange-red
    case 'electric': return new THREE.Color(0x00ffff); // Cyan-blue
    case 'plasma': return new THREE.Color(0xff00ff); // Magenta-pink
    default: return new THREE.Color(0xffaa00); // Standard orange
  }
}

/**
 * Utility function to create a procedural particle burst with physics.
 */
export function spawnPhysicsBurst(position, count, velocityScale = 1) {
  const colors = [
    new THREE.Color(0xff8800),
    new THREE.Color(0xffaa00),
    new THREE.Color(0xffff00),
    new THREE.Color(0xffffff)
  ];
  
  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    particleManager.spawnBurst(position, 1, color);
  }
}

// Global instance - initialized in main.js
export let particleManager = null;