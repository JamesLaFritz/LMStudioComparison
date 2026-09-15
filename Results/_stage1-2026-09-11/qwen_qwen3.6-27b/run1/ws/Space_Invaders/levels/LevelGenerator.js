/**
 * LevelGenerator — produces per-wave configuration for the alien grid.
 * Each wave increases speed, fire rate, and drops the grid lower.
 */

export class LevelGenerator {
    constructor() {
        this.wave = 0;
    }

    /**
     * Get config for the next wave. Call after each wave clears.
     * @returns {{ wave: number, speedMult: number, fireRate: number, startOffsetY: number, alienCount: number }}
     */
    next() {
        this.wave++;
        return {
            wave: this.wave,
            speedMult: 1.0 + (this.wave - 1) * 0.15,
            fireRate: Math.max(0.2, 1.2 - (this.wave - 1) * 0.08),
            startOffsetY: Math.min((this.wave - 1) * 0.3, 3.0),
            alienCount: 55, // 5 rows × 11 cols
        };
    }

    /** Reset to wave 0 (for game restart). */
    reset() {
        this.wave = 0;
    }

    /** Current wave number (0 = not started). */
    get currentWave() {
        return this.wave;
    }
}
