/**
 * HitStopManager - Frame freeze on impact for AAA game feel
 * 
 * Implements the "hit-stop" technique where time freezes briefly
 * on heavy impacts to emphasize collision weight and player agency.
 */

import { TimeManager } from '../core/TimeManager.js';

export class HitStopManager {
    constructor() {
        this.framesRemaining = 0;
        this.totalFrames = 0;
        this.isActive = false;
        
        // Default duration in frames (at 60fps, 6 frames = 100ms)
        this.defaultDuration = 6;
        this.strongDuration = 12;
    }

    /**
     * Trigger a hit-stop freeze for the specified number of frames
     * @param {number} durationFrames - Number of frames to freeze (default: 6)
     */
    trigger(durationFrames = this.defaultDuration) {
        this.framesRemaining = durationFrames;
        this.totalFrames = durationFrames;
        this.isActive = true;
        
        // Pause the time manager to freeze delta accumulation
        TimeManager.setPaused(true);
    }

    /**
     * Trigger a strong hit-stop for major impacts (boss kills, etc.)
     */
    triggerStrong() {
        this.trigger(this.strongDuration);
    }

    /**
     * Update the hit-stop state each frame
     * @returns {boolean} - True if currently in hit-stop state
     */
    update() {
        if (!this.isActive) {
            return false;
        }

        this.framesRemaining--;

        // Check if we've completed the freeze duration
        if (this.framesRemaining <= 0) {
            this.isActive = false;
            this.framesRemaining = 0;
            
            // Resume normal time flow
            TimeManager.setPaused(false);
            
            return false;
        }

        return true;
    }

    /**
     * Get the remaining freeze duration as a percentage (0-1)
     * Useful for visual effects during hit-stop
     * @returns {number} - Progress from 1 (just started) to 0 (ending)
     */
    getProgress() {
        if (!this.isActive || this.totalFrames === 0) {
            return 0;
        }
        
        return this.framesRemaining / this.totalFrames;
    }

    /**
     * Check if hit-stop is currently active
     * @returns {boolean}
     */
    getActive() {
        return this.isActive;
    }

    /**
     * Get remaining frames in current hit-stop
     * @returns {number}
     */
    getRemainingFrames() {
        return this.framesRemaining;
    }

    /**
     * Reset the hit-stop manager to initial state
     */
    reset() {
        this.framesRemaining = 0;
        this.totalFrames = 0;
        this.isActive = false;
        
        // Ensure time is not paused by us
        if (TimeManager.isPaused()) {
            TimeManager.setPaused(false);
        }
    }

    /**
     * Set custom duration values
     * @param {number} defaultDuration - Default freeze frames
     * @param {number} strongDuration - Strong impact freeze frames
     */
    setDurations(defaultDuration, strongDuration) {
        this.defaultDuration = Math.max(1, Math.floor(defaultDuration));
        this.strongDuration = Math.max(1, Math.floor(strongDuration));
    }
}

// Singleton instance for global access
export const hitStopManager = new HitStopManager();