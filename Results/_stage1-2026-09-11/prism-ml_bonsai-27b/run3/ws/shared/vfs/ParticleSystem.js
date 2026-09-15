/**
 * ParticleSystem - Manages particle effects for explosions, thrust, etc.
 */

class ParticleSystem {
  constructor() {
    this.particles = []; // Array of active particles
    this._nextId = 0;
  }

  /**
   * Emit a burst of particles at the given position.
   * @param {string} type - Type of particle (explosion, thrust, etc.)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   * @param {number} count - Number of particles to emit
   */
  emit(type, x, y, z, count = 10) {
    const colors = {
      explosion: [0xff4444, 0xffaa00, 0x88ff00],
      thrust: [0x00ffaa, 0x00cc88, 0x00ffdd]
    };

    const colorPalette = colors[type] || colors.explosion;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 3.0;
      const particle = {
        x: x,
        y: y,
        z: z,
        vx: Math.cos(angle) * speed,
        vy: (Math.random() - 0.5) * speed,
        vz: (Math.random() - 0.5) * speed,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        size: 0.1 + Math.random() * 0.4,
        color: colorPalette[Math.floor(Math.random() * colorPalette.length)],
        id: this._nextId++
      };

      this.particles.push(particle);
    }
  }

  /**
   * Update all particles for one frame.
   */
  update(deltaTime) {
    const now = performance.now();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p || !p.life) continue;

      // Update position
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.z += p.vz * deltaTime;

      // Apply gravity to Y axis
      p.vy -= 9.81 * deltaTime;

      // Decay life
      p.life -= p.decay * deltaTime;

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Get all active particles.
   */
  getParticles() {
    return [...this.particles];
  }

  /**
   * Clear all particles.
   */
  clear() {
    this.particles = [];
  }

  /**
   * Get count of active particles.
   */
  get size() {
    return this.particles.length;
  }

  /**
   * Reset particle system with new ID counter.
   */
  reset() {
    this.clear();
    this._nextId = 0;
  }
}

export default ParticleSystem;