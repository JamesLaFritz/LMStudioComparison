import { Vector3 } from 'three';

/**
 * Utility class for common mathematical operations used in game physics and procedural generation.
 */
export class MathUtils {
    /**
     * Clamps a value between a minimum and maximum range.
     * @param {number} val - The value to clamp.
     * @param {number} min - The lower bound.
     * @param {number} max - The upper bound.
     * @returns {number} The clamped value.
     */
    static clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    /**
     * Linearly interpolates between two values.
     * @param {number} start - Start value.
     * @param {number} end - End value.
     * @param {number} alpha - Interpolation factor (0 to 1).
     * @returns {number} The interpolated value.
     */
    static lerp(start, end, alpha) {
        return start + (end - start) * alpha;
    }

    /**
     * Generates a random float between min and max.
     * @param {number} min 
     * @param {number} max 
     * @returns {number}
     */
    static randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    /**
     * Returns a value between 0 and 1 based on a sine wave.
     * Useful for oscillating effects like pulsing lights or breathing UI.
     * @param {number} time - Current game time.
     * @param {number} speed - Frequency of oscillation.
     * @returns {number}
     */
    static sineWave(time, speed = 1) {
        return (Math.sin(time * speed) + 1) / 2;
    }

    /**
     * Simple pseudo-random hash function for deterministic procedural generation.
     * @param {string|number} seed 
     * @returns {number} A float between 0 and 1.
     */
    static hash(seed) {
        let h = 0;
        const s = String(seed);
        for (let i = 0; i < s.length; i++) {
            h = Math.imul(31, h) + s.charCodeAt(i) | 0;
        }
        return (h >>> 0) / 4294967296;
    }
}
