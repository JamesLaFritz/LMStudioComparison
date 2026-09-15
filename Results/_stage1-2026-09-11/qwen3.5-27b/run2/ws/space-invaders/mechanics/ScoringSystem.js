/**
 * Scoring System - Tracks points, multipliers, level progression
 */

export class ScoringSystem {
    constructor() {
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('spaceInvadersHighScore')) || 0;
        this.level = 1;
        this.lives = 3;
        
        // Combo system
        this.comboCount = 0;
        this.maxCombo = 0;
        this.comboMultiplier = 1;
        this.comboTimer = null;
        this.COMBO_DECAY_TIME = 5000; // 5 seconds to maintain combo
        
        // Level progression
        this.invadersKilledThisLevel = 0;
        this.totalInvadersPerLevel = 50;
        
        // UFO tracking
        this.ufoDirection = 'left'; // or 'right'
    }

    /**
     * Add points with combo multiplier
     */
    addPoints(basePoints, position) {
        const multipliedPoints = Math.floor(basePoints * this.comboMultiplier);
        this.score += multipliedPoints;
        
        if (position) {
            // Emit event for floating text
            this.onScoreUpdate(multipliedPoints, position);
        }
        
        return multipliedPoints;
    }

    /**
     * Kill an invader - handles combo and level progression
     */
    killInvader(invaderType, position) {
        const points = this.getInvaderPoints(invaderType);
        this.addPoints(points, position);
        
        // Increment combo
        this.incrementCombo();
        this.invadersKilledThisLevel++;
        
        return points;
    }

    /**
     * Kill a UFO - special scoring
     */
    killUFO(position) {
        const ufoPoints = this.getUFOPoints();
        this.addPoints(ufoPoints, position);
        this.incrementCombo();
        
        return ufoPoints;
    }

    /**
     * Get base points for invader type
     */
    getInvaderPoints(type) {
        switch (type) {
            case 'squid': return 30;
            case 'crab': return 20;
            case 'octopus': return 10;
            default: return 10;
        }
    }

    /**
     * Get UFO points based on direction (classic behavior)
     */
    getUFOPoints() {
        // UFOs moving right are worth more when they've traveled further
        const basePoints = this.ufoDirection === 'right' ? 300 : 200;
        
        // Randomize slightly for variety
        return Math.floor(basePoints * (1 + Math.random() * 0.5));
    }

    /**
     * Increment combo counter with decay timer
     */
    incrementCombo() {
        this.comboCount++;
        if (this.comboCount > this.maxCombo) {
            this.maxCombo = this.comboCount;
        }
        
        // Update multiplier based on combo count
        this.updateMultiplier();
        
        // Reset decay timer
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
        }
        this.comboTimer = setTimeout(() => {
            this.decayCombo();
        }, this.COMBO_DECAY_TIME);
    }

    /**
     * Decay combo back to 1x multiplier
     */
    decayCombo() {
        if (this.comboCount > 0) {
            this.onComboReset(this.comboCount);
        }
        
        this.comboCount = 0;
        this.comboMultiplier = 1;
    }

    /**
     * Update multiplier based on combo count
     */
    updateMultiplier() {
        if (this.comboCount >= 20) {
            this.comboMultiplier = 3;
        } else if (this.comboCount >= 10) {
            this.comboMultiplier = 2;
        } else {
            this.comboMultiplier = 1;
        }
    }

    /**
     * Lose a life
     */
    loseLife() {
        this.lives--;
        
        // Reset combo on death
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
        }
        this.decayCombo();
        
        return this.lives;
    }

    /**
     * Check if level is complete
     */
    isLevelComplete() {
        return this.invadersKilledThisLevel >= this.totalInvadersPerLevel;
    }

    /**
     * Advance to next level
     */
    advanceLevel() {
        this.level++;
        this.invadersKilledThisLevel = 0;
        
        // Bonus points for clearing a level
        const levelBonus = this.level * 100;
        this.score += levelBonus;
        
        return this.level;
    }

    /**
     * Check if game is over
     */
    isGameOver() {
        return this.lives <= 0;
    }

    /**
     * Reset for new game
     */
    reset() {
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.comboCount = 0;
        this.maxCombo = 0;
        this.comboMultiplier = 1;
        this.invadersKilledThisLevel = 0;
        
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
        }
    }

    /**
     * Update high score if needed
     */
    updateHighScore() {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('spaceInvadersHighScore', this.highScore.toString());
            return true; // New high score!
        }
        return false;
    }

    /**
     * Get current invader speed multiplier based on kills
     */
    getSpeedMultiplier() {
        const killPercentage = this.invadersKilledThisLevel / this.totalInvadersPerLevel;
        return 1 + (killPercentage * 0.5); // Up to 1.5x faster
    }

    /**
     * Event callbacks - set by game
     */
    onScoreUpdate = null;
    onComboReset = null;
}
