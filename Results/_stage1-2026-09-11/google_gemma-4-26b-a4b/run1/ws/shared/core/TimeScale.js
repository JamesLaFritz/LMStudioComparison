/**
 * Global time scale controller for hit-stop and slow-motion effects.
 */
export class TimeScale {
    constructor() {
        this.scale = 1.0;
        this.targetScale = 1.0;
        this.lerpSpeed = 0.1;
    }

    /**
     * Updates the current scale to move towards the target scale.
     * @param number deltaTime - The time elapsed since last frame.
     */
    update(deltaTime) {
        this.scale += (this.targetScale - this.scale) * this.lerpSpeed;
        
        // Snap to target if very close to prevent infinite tiny updates
        if (Math.abs(this.scale - this.targetScale) < 0.001) {
            this.scale = this.targetScale;
        }
    }

    /**
     * Triggers a brief time dilation effect (hit-stop).
     * @param number duration - How long the slowdown lasts in seconds.
     * @param number scale - The scale to drop to (e.g., 0.05).
     */
    triggerHitStop(duration, scale = 0.05) {
        this.targetScale = scale;
        // We use a timeout or a frame-based countdown in the engine loop
        // For simplicity here, we'll handle the reset via an external trigger 
        // or by checking duration in the main loop.
    }

    setTarget(value) {
        this.targetScale = value;
    }

    get current() {
        return this.scale;
    }
}

export const timeScale = new TimeScale();
