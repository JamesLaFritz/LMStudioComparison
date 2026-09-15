/**
 * Explosion Burst - Multi-layered explosion effects with shockwave rings
 */
class ExplosionBurst {
    constructor(particleManager, position, intensity = 1.0) {
        this.particleManager = particleManager;
        this.position = position.clone();
        this.intensity = Math.min(intensity, 2.0); // Cap at 2x

        // Particle properties
        this.age = 0;
        this.lifetime = 1.5 * intensity; // Longer lifetime for larger explosions
        this.particles = [];

        // Initialize explosion particles
        this._initializeParticles();
    }

    _initializeParticles() {
        const particleCount = Math.floor(20 * this.intensity);

        for (let i = 0; i < particleCount; i++) {
            // Create spherical distribution of particles
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(1 - 2 * Math.random());

            const direction = new Vector3(
                Math.sin(phi) * Math.cos(theta),
                Math.sin(phi) * Math.sin(theta),
                Math.cos(phi)
            );

            // Random velocity with some randomness
            const speed = (Math.random() + 0.5) * this.intensity;
            const velocity = direction.clone().multiplyScalar(speed);

            // Create particle with random properties
            const particle = {
                position: new Vector3(
                    this.position.x,
                    this.position.y,
                    this.position.z
                ),
                velocity: velocity,
                size: Math.random() * 0.5 + 0.2,
                color: new Color().setHSL(Math.random(), 1.0, 0.8), // Fire colors
                age: 0,
                lifetime: this.lifetime * (0.5 + Math.random()),
            };

            this.particles.push(particle);
        }
    }

    update(deltaTime) {
        this.age += deltaTime;

        const progress = this.age / this.lifetime;

        // Update all particles
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];

            // Update position based on velocity
            particle.position.x += particle.velocity.x * deltaTime;
            particle.position.y += particle.velocity.y * deltaTime;
            particle.position.z += particle.velocity.z * deltaTime;

            // Apply gravity to particles
            particle.velocity.y -= 0.5 * deltaTime;

            // Update age and check if dead
            particle.age += deltaTime;
            const particleProgress = particle.age / particle.lifetime;

            // Fade out color as particle ages
            particle.color.setHSL(
                Math.max(particle.color.h - particleProgress * 0.3, 0),
                Math.max(particle.color.s - particleProgress * 0.5, 0),
                Math.max(particle.color.l - particleProgress * 0.8, 0)
            );
        }

        // Return false when explosion is done
        return this.age < this.lifetime;
    }

    dispose() {
        // Clear all references
        this.particles = [];
        this.position = null;
        this.particleManager = null;
    }
}

export default ExplosionBurst;
