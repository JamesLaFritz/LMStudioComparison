import * as THREE from 'three';

/**
 * ParticleManager - Object-pooled particle system with 500 hard cap
 * All particles pre-allocated, recycled in-place for zero GC pressure
 */
export class ParticleManager {
  constructor(maxParticles = 500) {
    this.maxParticles = maxParticles;
    this.activeParticles = [];
    this.pool = [];

    // Pre-create geometry and material (shared across all particles)
    this.geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    
    // Pre-allocate all particle objects
    for (let i = 0; i < maxParticles; i++) {
      this.pool.push(this.createParticleObject());
    }

    // Track total spawned for debugging
    this.totalSpawned = 0;
  }

  createParticleObject() {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    return {
      mesh: new THREE.Mesh(this.geometry, material),
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      acceleration: new THREE.Vector3(0, 0, 0),
      lifetime: 0,
      maxLifetime: 1.0,
      scale: new THREE.Vector3(1, 1, 1),
      rotationSpeed: new THREE.Vector3(0, 0, 0),
      color: new THREE.Color(1, 1, 1),
      active: false,
      type: 'box' // box, sphere, spark
    };
  }

  /**
   * Spawn an explosion burst of particles at a position
   * @param {THREE.Vector3} position - World space spawn position
   * @param {number} count - Number of particles to spawn (respects hard cap)
   * @param {number|string|THREE.Color} color - Particle color
   * @param {number} velocitySpread - Random velocity magnitude
   * @param {number} lifetimeRangeMin - Minimum particle lifetime
   * @param {number} lifetimeRangeMax - Maximum particle lifetime
   */
  spawnBurst(position, count = 10, color = '#ffffff', velocitySpread = 5, 
             lifetimeRangeMin = 0.3, lifetimeRangeMax = 0.8) {
    const available = this.maxParticles - this.activeParticles.length;
    const toSpawn = Math.min(count, available);

    if (toSpawn <= 0) return; // Hard cap reached

    const colorObj = typeof color === 'string' 
      ? new THREE.Color(color) 
      : color instanceof THREE.Color ? color : new THREE.Color(color);

    for (let i = 0; i < toSpawn; i++) {
      let particle;

      if (this.pool.length > 0) {
        particle = this.pool.pop();
      } else {
        // Emergency: recycle oldest active particle
        const oldest = this.activeParticles.shift();
        this.recycleParticle(oldest);
        particle = oldest;
      }

      // Initialize burst parameters
      particle.position.copy(position);
      
      // Spherical velocity distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = Math.sqrt(Math.random()) * velocitySpread;

      particle.velocity.set(
        speed * Math.sin(phi) * Math.cos(theta),
        speed * Math.sin(phi) * Math.sin(theta),
        speed * Math.cos(phi)
      );

      // Slight upward bias for explosions
      particle.velocity.y += velocitySpread * 0.3;

      particle.lifetime = particle.maxLifetime = 
        lifetimeRangeMin + Math.random() * (lifetimeRangeMax - lifetimeRangeMin);

      particle.color.copy(colorObj);
      particle.mesh.material.color.copy(particle.color);
      
      // Random scale variation
      const scaleVar = 0.5 + Math.random();
      particle.scale.set(scaleVar, scaleVar, scaleVar);
      particle.mesh.scale.copy(particle.scale);

      // Random rotation speed
      particle.rotationSpeed.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );

      // Random shape variation
      particle.type = Math.random() > 0.7 ? 'spark' : 'box';
      
      if (particle.type === 'spark') {
        const sparkScale = 0.3 + Math.random() * 0.5;
        particle.scale.set(sparkScale, sparkScale * 2, sparkScale);
        particle.mesh.scale.copy(particle.scale);
      }

      particle.active = true;
      this.activeParticles.push(particle);
      this.totalSpawned++;
    }
  }

  /**
   * Spawn a directed projectile trail
   */
  spawnTrail(position, direction, count = 5, color = '#00ffff') {
    for (let i = 0; i < count; i++) {
      let particle;

      if (this.pool.length > 0) {
        particle = this.pool.pop();
      } else {
        const oldest = this.activeParticles.shift();
        this.recycleParticle(oldest);
        particle = oldest;
      }

      // Offset along direction
      const offset = new THREE.Vector3().copy(direction).normalize().multiplyScalar(
        (Math.random() - 0.5) * 0.2
      );
      particle.position.copy(position).add(offset);

      // Small random velocity perpendicular to direction
      const perpDir = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
      particle.velocity.copy(perpDir).multiplyScalar((Math.random() - 0.5) * 2);
      particle.velocity.y += Math.random() * 1;

      particle.lifetime = particle.maxLifetime = 0.2 + Math.random() * 0.3;
      particle.color.set(color);
      particle.mesh.material.color.copy(particle.color);

      const scaleVar = 0.3 + Math.random() * 0.4;
      particle.scale.set(scaleVar, scaleVar, scaleVar);
      particle.mesh.scale.copy(particle.scale);

      particle.rotationSpeed.set(0, 0, (Math.random() - 0.5) * 20);
      particle.type = 'box';
      particle.active = true;

      this.activeParticles.push(particle);
    }
  }

  /**
   * Spawn a single spark for hit effects
   */
  spawnSpark(position, color = '#ffff00') {
    let particle;

    if (this.pool.length > 0) {
      particle = this.pool.pop();
    } else {
      const oldest = this.activeParticles.shift();
      this.recycleParticle(oldest);
      particle = oldest;
    }

    particle.position.copy(position);
    
    // Upward velocity with spread
    particle.velocity.set(
      (Math.random() - 0.5) * 3,
      Math.random() * 4 + 2,
      (Math.random() - 0.5) * 3
    );

    particle.lifetime = particle.maxLifetime = 0.15 + Math.random() * 0.15;
    particle.color.set(color);
    particle.mesh.material.color.copy(particle.color);

    const scaleVar = 0.2 + Math.random() * 0.3;
    particle.scale.set(scaleVar, scaleVar * 3, scaleVar);
    particle.mesh.scale.copy(particle.scale);

    particle.rotationSpeed.z = (Math.random() - 0.5) * 30;
    particle.type = 'spark';
    particle.active = true;

    this.activeParticles.push(particle);
  }

  /**
   * Update all active particles
   * @param {number} dt - Delta time in seconds
   */
  update(dt, scene) {
    // Apply gravity to all particles
    const gravityY = -15 * dt;

    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];

      // Update lifetime
      p.lifetime -= dt;

      // Calculate normalized lifetime for interpolation
      const t = p.lifetime / p.maxLifetime;

      // Apply velocity
      p.position.addScaledVector(p.velocity, dt);

      // Apply gravity
      p.velocity.y += gravityY;

      // Apply acceleration (for directed particles)
      if (!p.acceleration.isZero()) {
        p.velocity.addScaledVector(p.acceleration, dt);
      }

      // Rotate particle
      const rotDt = dt * 60; // Assume 60fps base
      p.mesh.rotation.x += p.rotationSpeed.x * rotDt;
      p.mesh.rotation.y += p.rotationSpeed.y * rotDt;
      p.mesh.rotation.z += p.rotationSpeed.z * rotDt;

      // Update position in mesh
      p.mesh.position.copy(p.position);

      // Fade out based on lifetime (ease-out)
      const alpha = Math.pow(t, 0.5);
      p.mesh.material.opacity = alpha;

      // Scale down near death
      const scaleFade = 0.5 + t * 0.5;
      p.mesh.scale.copy(p.scale).multiplyScalar(scaleFade);

      // Hide when nearly invisible
      if (alpha < 0.02) {
        this.recycleParticle(p);
        this.activeParticles.splice(i, 1);
        continue;
      }

      // Ensure visible
      p.mesh.visible = true;
    }
  }

  /**
   * Recycle a particle back to the pool
   */
  recycleParticle(particle) {
    particle.active = false;
    particle.mesh.visible = false;
    particle.mesh.position.set(9999, 9999, 9999);
    particle.velocity.set(0, 0, 0);
    particle.acceleration.set(0, 0, 0);
    particle.lifetime = 0;
    particle.maxLifetime = 1.0;
    particle.scale.set(1, 1, 1);
    particle.rotationSpeed.set(0, 0, 0);
    this.pool.push(particle);
  }

  /**
   * Get current active particle count
   */
  getActiveCount() {
    return this.activeParticles.length;
  }

  /**
   * Get pool availability percentage
   */
  getPoolAvailability() {
    return (this.pool.length / this.maxParticles) * 100;
  }

  /**
   * Clear all active particles immediately
   */
  clearAll() {
    while (this.activeParticles.length > 0) {
      const p = this.activeParticles.pop();
      this.recycleParticle(p);
    }
  }

  /**
   * Dispose all resources (call on game end)
   */
  dispose() {
    // Recycle all active particles first
    this.clearAll();

    // Dispose geometry
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }

    // Dispose all particle materials
    for (const p of this.pool) {
      if (p.mesh && p.mesh.material) {
        p.mesh.material.dispose();
      }
      if (p.mesh) {
        p.mesh.geometry = null;
        p.mesh.material = null;
      }
    }

    this.pool = [];
    this.activeParticles = [];
  }
}
