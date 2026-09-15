/**
 * Particle Manager - Centralized particle pool with strict 500-particle cap
 */
class ParticleManager {
    constructor() {
        this.particles = [];
        this.maxParticles = 500; // Strict cap

        // Initialize particle pools for different types
        this._explosionPool = new Array(200);
        this._sparkPool = new Array(150);
        this._shockwavePool = new Array(150);

        // Fill pools with inactive particles
        for (let i = 0; i < this._explosionPool.length; i++) {
            this._explosionPool[i] = null;
        }
        for (let i = 0; i < this._sparkPool.length; i++) {
            this._sparkPool[i] = null;
        }
        for (let i = 0; i < this._shockwavePool.length; i++) {
            this._shockwavePool[i] = null;
        }
    }

    emitExplosion(position, intensity = 1.0) {
        if (this.particles.length >= this.maxParticles) return;

        const explosion = new ExplosionBurst(this, position, intensity);
        this.particles.push(explosion);

        // Add to explosion pool for reuse
        if (!this._explosionPool.includes(explosion)) {
            this._explosionPool[this._explosionPool.length] = explosion;
        }
    }

    emitSpark(position, velocity) {
        if (this.particles.length >= this.maxParticles) return;

        const spark = new SparkBurst(this, position, velocity);
        this.particles.push(spark);

        // Add to spark pool for reuse
        if (!this._sparkPool.includes(spark)) {
            this._sparkPool[this._sparkPool.length] = spark;
        }
    }

    emitShockwave(position) {
        if (this.particles.length >= this.maxParticles) return;

        const shockwave = new ShockwaveRing(this, position);
        this.particles.push(shockwave);

        // Add to shockwave pool for reuse
        if (!this._shockwavePool.includes(shockwave)) {
            this._shockwavePool[this._shockwavePool.length] = shockwave;
        }
    }

    update(deltaTime) {
        // Update all active particles and remove dead ones
        const toRemove = [];

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];

            if (!particle.update(deltaTime)) {
                toRemove.push(i);

                // Return to pool based on type
                if (particle instanceof ExplosionBurst) {
                    this._explosionPool[this._explosionPool.length] = particle;
                } else if (particle instanceof SparkBurst) {
                    this._sparkPool[this._sparkPool.length] = particle;
                } else if (particle instanceof ShockwaveRing) {
                    this._shockwavePool[this._shockwavePool.length] = particle;
                }
            }
        }

        // Remove dead particles in reverse order to maintain indices
        for (let i = toRemove.length - 1; i >= 0; i--) {
            const index = toRemove[i];
            this.particles.splice(index, 1);
        }
    }

    getActiveCount() {
        return this.particles.length;
    }

    clearAll() {
        // Dispose all particles and clear pools
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];

            if (particle instanceof ExplosionBurst) {
                particle.dispose();
            } else if (particle instanceof SparkBurst) {
                particle.dispose();
            } else if (particle instanceof ShockwaveRing) {
                particle.dispose();
            }
        }

        this.particles = [];
        this._explosionPool = new Array(200);
        this._sparkPool = new Array(150);
        this._shockwavePool = new Array(150);
    }

    destroy() {
        this.clearAll();

        // Clear all references
        this.particles = null;
        this._explosionPool = null;
        this._sparkPool = null;
        this._shockwavePool = null;
    }
}

export default ParticleManager;
