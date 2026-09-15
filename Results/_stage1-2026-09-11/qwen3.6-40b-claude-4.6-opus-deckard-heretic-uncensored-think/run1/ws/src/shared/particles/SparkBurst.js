/**
 * Spark Burst - High-speed spark particles for impacts
 */
class SparkBurst {
    constructor(particleManager, position, velocity) {
        this.particleManager = particleManager;
        this.position = position.clone();
        this.velocity = velocity || new Vector3(0, 0, 0);

        // Particle properties
        this.age = 0;
        this.lifetime = 0.5;
        this.particles = [];

        // Initialize spark particles
        this._initializeParticles();
    }

    _initializeParticles() {
        const particleCount = Math.floor(10 * Math.min(this.velocity.length(), 2));

        for (let i = 0; i < particleCount; i++) {
            // Create sparks in direction of velocity with spread
            const angle = Math.random() * Math.PI * 0.5;
            const speed = this.velocity.length() * (Math.random() + 0.3);

            const spark = {
                position: new Vector3(
                    this.position.x,
                    this.position.y,
                    this.position.z
                ),
                velocity: new Vector3(
                    this.velocity.x + Math.sin(angle) * speed,
                    this.velocity.y + Math.cos(angle) * speed,
                    this.velocity.z
                ),
                size: Math.random() * 0.2 + 0.1,
                color: new Color().setHSL(Math.random(), 1.0, 1.0), // Bright sparks
                age: 0,
                lifetime: this.lifetime * (0.3 + Math.random()),
            };

            this.particles.push(spark);
        }
    }

    update(deltaTime) {
        this.age += deltaTime;

        const progress = this.age / this.lifetime;

        // Update all particles
        for (let i = 0; i < this.particles.length; i++) {
            const spark = this.particles[i];

            // Update position based on velocity
            spark.position.x += spark.velocity.x * deltaTime;
            spark.position.y += spark.velocity.y * deltaTime;
            spark.position.z += spark.velocity.z * deltaTime;

            // Apply gravity to sparks
            spark.velocity.y -= 0.8 * deltaTime;

            // Update age and check if dead
            spark.age += deltaTime;
            const sparkProgress = spark.age / spark.lifetime;

            // Fade out color as spark ages
            spark.color.setHSL(
                Math.max(spark.color.h - sparkProgress * 0.2, 0),
                Math.max(spark.color.s - sparkProgress * 0.3, 0),
                Math.max(spark.color.l - sparkProgress * 0.9, 0)
            );
        }

        // Return false when sparks are done
        return this.age < this.lifetime;
    }

    dispose() {
        // Clear all references
        this.particles = [];
        this.position = null;
        this.velocity = null;
        this.particleManager = null;
    }
}

export default SparkBurst;
