/**
 * TimeManager - Centralized time control for the game loop
 * Handles delta time calculation, pause state, and slow-motion effects
 */

export class TimeManager {
    constructor() {
        this.lastFrameTime = performance.now();
        this.deltaTime = 0;
        this.accumulatedTime = 0;
        this.isPaused = false;
        this.timeScale = 1.0; // For slow-motion effects
        
        // Cap delta time to prevent spiral of death
        this.maxDeltaTime = 0.1;
        
        // Target fixed timestep for physics (optional)
        this.fixedTimestep = 1/60;
    }
    
    /**
     * Update the time manager - call at start of each frame
     */
    update() {
        const currentTime = performance.now();
        
        if (!this.isPaused) {
            let rawDelta = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
            
            // Cap delta time
            rawDelta = Math.min(rawDelta, this.maxDeltaTime);
            
            // Apply time scale for slow-motion
            this.deltaTime = rawDelta * this.timeScale;
            
            // Accumulate time for fixed timestep updates (if needed)
            this.accumulatedTime += this.deltaTime;
        } else {
            this.deltaTime = 0;
        }
        
        this.lastFrameTime = currentTime;
    }
    
    /**
     * Get the delta time for this frame (in seconds)
     */
    getDelta() {
        return this.deltaTime;
    }
    
    /**
     * Set pause state - used by HitStopManager and game states
     */
    setPaused(paused) {
        this.isPaused = paused;
    }
    
    /**
     * Check if currently paused
     */
    isGamePaused() {
        return this.isPaused;
    }
    
    /**
     * Set time scale for slow-motion effects (1.0 = normal, 0.5 = half speed)
     */
    setTimeScale(scale) {
        this.timeScale = Math.max(0, scale);
    }
    
    /**
     * Reset to normal time flow
     */
    resetTimeScale() {
        this.timeScale = 1.0;
    }
    
    /**
     * Get fixed timestep for physics updates (if using)
     */
    getFixedTimestep() {
        return this.fixedTimestep;
    }
    
    /**
     * Reset the time manager - call on game restart
     */
    reset() {
        this.lastFrameTime = performance.now();
        this.deltaTime = 0;
        this.accumulatedTime = 0;
        this.isPaused = false;
        this.timeScale = 1.0;
    }
}

// Singleton instance
export const timeManager = new TimeManager();
