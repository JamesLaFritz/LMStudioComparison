/**
 * CameraShake - Trauma-based decay shake system
 * Accumulates "trauma" on impacts, decays exponentially over time
 */

export class CameraShake {
    constructor(camera) {
        this.camera = camera;
        this.trauma = 0;
        this.decayFactor = 0.92; // Decay per frame
        this.maxTrauma = 3.0; // Cap shake intensity
        
        // Store original position for restoration
        this.originalPosition = camera.position.clone();
        this.originalQuaternion = camera.quaternion.clone();
        
        // Shake parameters
        this.shakeDuration = 0;
        this.intensityMultiplier = 1.0;
    }

    /**
     * Add trauma from an impact event
     * @param {number} impactVelocity - Velocity of the impacting object
     * @param {number} multiplier - Optional intensity multiplier (default: 1)
     */
    addTrauma(impactVelocity, multiplier = 1.0) {
        const traumaToAdd = Math.min(impactVelocity * this.intensityMultiplier * 0.5, 2.0);
        this.trauma += traumaToAdd;
        
        // Cap the trauma to prevent excessive shaking
        if (this.trauma > this.maxTrauma) {
            this.trauma = this.maxTrauma;
        }
    }

    /**
     * Set intensity multiplier for all future shakes
     * @param {number} value - Multiplier value (1.0 = normal)
     */
    setIntensityMultiplier(value) {
        this.intensityMultiplier = Math.max(0, value);
    }

    /**
     * Update the camera position with shake effect
     * Call this every frame before rendering
     */
    update() {
        // Decay trauma over time
        if (this.trauma > 0) {
            this.trauma *= this.decayFactor;
            
            // Stop updating when trauma is negligible
            if (this.trauma < 0.01) {
                this.trauma = 0;
                this.reset();
                return;
            }
        }

        if (this.trauma > 0) {
            const intensity = Math.min(this.trauma, this.maxTrauma);
            
            // Apply random offset based on trauma level
            const offsetX = (Math.random() - 0.5) * intensity;
            const offsetY = (Math.random() - 0.5) * intensity;
            const offsetZ = (Math.random() - 0.5) * intensity * 0.3; // Less Z shake
            
            this.camera.position.x = this.originalPosition.x + offsetX;
            this.camera.position.y = this.originalPosition.y + offsetY;
            this.camera.position.z = this.originalPosition.z + offsetZ;
            
            // Add slight rotation for more dramatic effect
            if (intensity > 1.0) {
                const rotIntensity = intensity * 0.02;
                this.camera.rotation.x = 
                    this.originalQuaternion.x + (Math.random() - 0.5) * rotIntensity;
                this.camera.rotation.y = 
                    this.originalQuaternion.y + (Math.random() - 0.5) * rotIntensity;
            }
        } else {
            // Ensure camera is at original position when no trauma
            this.reset();
        }
    }

    /**
     * Reset camera to original position and orientation
     */
    reset() {
        this.camera.position.copy(this.originalPosition);
        this.camera.quaternion.copy(this.originalQuaternion);
        this.camera.rotation.set(0, 0, 0);
    }

    /**
     * Set the original camera position (use after moving camera intentionally)
     */
    setOriginalPosition(position, quaternion = null) {
        this.originalPosition.copy(position);
        if (quaternion) {
            this.originalQuaternion.copy(quaternion);
        } else {
            this.originalQuaternion.set(0, 0, 0);
        }
    }

    /**
     * Get current trauma level (for debugging or UI feedback)
     */
    getTraumaLevel() {
        return this.trauma;
    }

    /**
     * Manually clear all trauma immediately
     */
    clearTrauma() {
        this.trauma = 0;
        this.reset();
    }
}

export default CameraShake;
