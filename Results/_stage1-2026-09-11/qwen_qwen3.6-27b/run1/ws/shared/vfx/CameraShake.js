/**
 * Trauma-based camera shake system.
 * Accumulates trauma from events; decays exponentially each frame.
 * Camera offset = trauma × random direction × per-axis falloff.
 */
export class CameraShake {
    constructor(camera) {
        this.camera = camera;
        this.basePosition = camera.position.clone();
        this.baseTarget = camera.position.clone(); // for perspective cameras

        this.trauma = 0;
        this.maxTrauma = 0;
        this.duration = 0;
        this.elapsed = 0;

        // Decay per frame (at 60fps)
        this.decayRate = 0.92;

        // Per-axis multipliers for organic feel
        this.axisMultiplier = { x: 1.0, y: 0.7, z: 0.3 };

        // Random direction accumulator (smooth noise)
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeZ = 0;
    }

    /**
     * Add shake trauma. Higher intensity = more violent shake.
     * @param {number} intensity - Base intensity (0-5)
     * @param {number} duration - How long the shake lasts (seconds)
     */
    shake(intensity, duration) {
        this.trauma = Math.min(this.trauma + intensity, 10);
        this.maxTrauma = Math.max(this.maxTrauma, this.trauma);
        this.duration = Math.max(this.duration, duration);
    }

    /**
     * Scale intensity based on impact velocity.
     * @param {number} velocity - Impact velocity magnitude
     * @param {number} duration - Shake duration
     */
    shakeFromVelocity(velocity, duration) {
        const intensity = Math.min(velocity * 0.5, 5);
        if (intensity > 0.1) {
            this.shake(intensity, duration);
        }
    }

    update(dt) {
        if (this.duration <= 0) return;

        this.elapsed += dt;
        if (this.elapsed >= this.duration) {
            this.trauma = 0;
            this.maxTrauma = 0;
            this.duration = 0;
            this.elapsed = 0;
            this.shakeX = 0;
            this.shakeY = 0;
            this.shakeZ = 0;
            return;
        }

        // Decay trauma
        this.trauma *= Math.pow(this.decayRate, dt * 60);

        if (this.trauma < 0.01) {
            this.trauma = 0;
            this.shakeX = 0;
            this.shakeY = 0;
            this.shakeZ = 0;
            return;
        }

        // Generate smooth random shake using sine waves with different frequencies
        const t = performance.now() * 0.001;
        this.shakeX = (Math.sin(t * 13.7) * 0.5 + Math.sin(t * 7.3) * 0.3 + Math.sin(t * 23.1) * 0.2) * this.trauma * this.axisMultiplier.x;
        this.shakeY = (Math.sin(t * 11.3 + 1) * 0.5 + Math.sin(t * 9.7 + 2) * 0.3 + Math.sin(t * 17.9 + 3) * 0.2) * this.trauma * this.axisMultiplier.y;
        this.shakeZ = (Math.sin(t * 8.1 + 4) * 0.5 + Math.sin(t * 14.5 + 5) * 0.3 + Math.sin(t * 19.3 + 6) * 0.2) * this.trauma * this.axisMultiplier.z;
    }

    /** Apply computed shake offsets to a camera. Called from GameEngine._render(). */
    applyTo(camera) {
        camera.position.x = this.basePosition.x + this.shakeX;
        camera.position.y = this.basePosition.y + this.shakeY;
        camera.position.z = this.basePosition.z + this.shakeZ;
    }

    reset() {
        this.trauma = 0;
        this.maxTrauma = 0;
        this.duration = 0;
        this.elapsed = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeZ = 0;
        this.camera.position.copy(this.basePosition);
    }

    setCamera(camera) {
        this.camera = camera;
        this.basePosition.copy(camera.position);
    }
}