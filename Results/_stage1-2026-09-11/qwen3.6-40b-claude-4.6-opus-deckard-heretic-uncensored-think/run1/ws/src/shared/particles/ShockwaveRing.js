/**
 * Shockwave Ring - Expanding emissive rings on impacts/deaths
 */
class ShockwaveRing {
    constructor(particleManager, position) {
        this.particleManager = particleManager;
        this.position = position.clone();

        // Ring properties
        this.age = 0;
        this.lifetime = 1.0;
        this.radius = 0.5;
        this.maxRadius = 3.0;
        this.expansionRate = 2.0;

        // Visual properties
        this.color = new Color().setHSL(0, 1.0, 1.0); // White shockwave
    }

    update(deltaTime) {
        this.age += deltaTime;

        const progress = this.age / this.lifetime;

        // Expand ring based on time
        this.radius = this.expansionRate * progress;

        // Fade out color as ring ages
        this.color.setHSL(
            Math.max(this.color.h - progress * 0.2, 0),
            Math.max(this.color.s - progress * 0.3, 0),
            Math.max(this.color.l - progress * 0.9, 0)
        );

        // Return false when ring is done
        return this.age < this.lifetime;
    }

    dispose() {
        // Clear all references
        this.position = null;
        this.particleManager = null;
    }
}

export default ShockwaveRing;
