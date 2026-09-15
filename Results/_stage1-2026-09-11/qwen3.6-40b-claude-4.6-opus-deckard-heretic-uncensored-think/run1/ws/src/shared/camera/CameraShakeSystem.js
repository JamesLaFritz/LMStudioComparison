/**
 * Camera Shake System - Trauma-based shake with decay curves and impact velocity scaling
 */
class CameraShakeSystem {
    constructor(camera) {
        this.camera = camera;
        this.shakeIntensity = 0;
        this.maxIntensity = 1.0;
        this.decayRate = 2.0; // Higher = faster decay

        // Shake parameters
        this.frequency = 30; // Hz
        this.amplitude = 0.5;

        // Time tracking
        this.time = 0;
        this.lastShakeTime = 0;
    }

    triggerShake(intensity, duration) {
        const clampedIntensity = Math.min(intensity, this.maxIntensity);
        this.shakeIntensity += clampedIntensity * duration;
        this.shakeIntensity = Math.min(this.shakeIntensity, this.maxIntensity);

        // Update timing for decay calculation
        this.lastShakeTime = performance.now();
    }

    update(deltaTime) {
        if (this.shakeIntensity > 0) {
            // Apply shake based on current intensity and time
            const timeOffset = performance.now() / 1000;

            // Calculate shake offsets using sine waves for organic motion
            const offsetX = Math.sin(timeOffset * this.frequency) * 
                           this.shakeIntensity * this.amplitude;
            const offsetY = Math.cos(timeOffset * this.frequency * 0.7) * 
                           this.shakeIntensity * this.amplitude * 0.7;

            // Apply to camera position relative to original position
            if (this.camera.originalPosition) {
                this.camera.position.x = this.camera.originalPosition.x + offsetX;
                this.camera.position.y = this.camera.originalPosition.y + offsetY;
            }
        } else {
            // Decay shake intensity over time
            this.shakeIntensity -= this.decayRate * deltaTime;
            if (this.shakeIntensity < 0) {
                this.shakeIntensity = 0;
            }

            // Reset camera to original position when done shaking
            if (this.shakeIntensity === 0 && this.camera.originalPosition) {
                this.camera.position.x = this.camera.originalPosition.x;
                this.camera.position.y = this.camera.originalPosition.y;
            }
        }
    }

    reset() {
        this.shakeIntensity = 0;
        if (this.camera.originalPosition) {
            this.camera.position.x = this.camera.originalPosition.x;
            this.camera.position.y = this.camera.originalPosition.y;
        }
    }

    destroy() {
        // Clear references
        this.camera = null;
        this.shakeIntensity = 0;
    }
}

export default CameraShakeSystem;
