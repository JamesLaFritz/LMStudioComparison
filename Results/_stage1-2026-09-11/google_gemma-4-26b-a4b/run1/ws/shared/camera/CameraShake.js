/**
 * CameraShake.js
 * A trauma-based camera shake system using a spring-damper model.
 * The 'trauma' value increases on impact and decays over time.
 */

export class CameraShake {
    constructor() {
        this.trauma = 0;
        this.maxTrauma = 1.0;
        this.decayRate = 1.5; // How fast trauma disappears
    }

    /**
     * Apply an impact to the camera shake.
     * @param {number} intensity - The strength of the impact (0 to 1).
     */
    applyImpact(intensity) {
        this.trauma = Math.min(this.maxTrauma, this.trauma + intensity);
    }

    /**
     * Updates the trauma value based on elapsed time.
     * @param {number} deltaTime - The time passed since last frame (scaled).
     */
    update(deltaTime) {
        if (this.traverma > 0) {
            // Exponential decay: T = T * e^(-decay * dt)
            this.trauma *= Math.exp(-this.decayRate * deltaTime);
        }
        if (this.trauma < 0.001) {
            this.trauma = 0;
        }
    }

    /**
     * Returns a 3D vector offset based on current trauma.
     * @returns {{x: number, y: number, z: number}}
     */
    getOffset() {
        if (this.trauma <= 0) return { x: 0, y: 0, z: 0 };

        // Use a pseudo-random approach based on trauma to create jitter
        // We use sine waves with different frequencies to simulate organic shaking
        const strength = this.trauma;
        return {
            x: (Math.sin(Date.now() * 0.05) * Math.cos(Date.now() * 0.02)) * strength,
            y: (Math.cos(Date.now() * 0.04) * Math.sin(Date.now() * 0.07)) * strength,
            z: (Math.sin(Date.now() * 0.03)) * strength * 0.5
        };
    }
}
