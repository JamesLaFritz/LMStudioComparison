/**
 * ScoreManager — Tracks score, combo multipliers, high scores, and UI updates
 */

export class ScoreManager {
  constructor(uiController) {
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('spaceInvadersHighScore')) || 0;
    
    // Combo system
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboWindowMs = 2000; // 2 seconds to chain kills
    
    // UI reference
    this.uiController = uiController;
    
    // Update initial display
    this.updateDisplay();
  }

  /**
   * Add points with optional combo multiplier
   */
  addPoints(basePoints, isComboKill = true) {
    if (isComboKill) {
      this.comboCount++;
      this.comboTimer = this.comboWindowMs;
      
      // Calculate multiplier: +10% per combo level, capped at 2x
      const multiplier = Math.min(1 + (this.comboCount - 1) * 0.1, 2.0);
      const finalPoints = Math.floor(basePoints * multiplier);
      
      return { points: finalPoints, isCombo: true, multiplier };
    } else {
      // Non-combo kill resets combo
      this.comboCount = 0;
      this.comboTimer = 0;
      return { points: basePoints, isCombo: false, multiplier: 1 };
    }
  }

  /**
   * Add score and trigger UI feedback
   */
  awardScore(points, worldPosition, text) {
    this.score += points;
    
    // Spawn floating text at impact location
    if (this.uiController && worldPosition) {
      const color = points > 20 ? '#ff0' : '#0f8';
      this.uiController.showFloatingText(text || `+${points}`, worldPosition, color);
    }
    
    this.updateDisplay();
  }

  /**
   * Update combo timer (call every frame)
   */
  updateComboTimer(deltaTime) {
    if (this.comboCount > 0) {
      this.comboTimer -= deltaTime * 1000; // convert to ms
      
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboTimer = 0;
      }
    }
    
    return this.comboCount > 1 ? this.comboCount : null;
  }

  /**
   * Check if high score was beaten
   */
  checkHighScore() {
    if (this.score >= this.highScore && this.score > 0) {
      this.highScore = this.score;
      localStorage.setItem('spaceInvadersHighScore', this.highScore.toString());
      return true;
    }
    return false;
  }

  /**
   * Update the UI display elements
   */
  updateDisplay() {
    if (this.uiController) {
      this.uiController.updateScore(this.score);
      this.uiController.updateHighScore(this.highScore);
      
      // Show combo indicator if active
      const combo = this.comboCount > 1 ? this.comboCount : null;
      this.uiController.setCombo(combo);
    }
  }

  /**
   * Reset for new game
   */
  reset() {
    this.score = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.updateDisplay();
  }

  /**
   * Get current score
   */
  getScore() {
    return this.score;
  }

  /**
   * Get high score
   */
  getHighScore() {
    return this.highScore;
  }

  /**
   * Get combo multiplier for display
   */
  getComboMultiplier() {
    if (this.comboCount <= 1) return null;
    return Math.min(1 + (this.comboCount - 1) * 0.1, 2.0);
  }

  /**
   * Calculate points for an invader type
   */
  static getInvaderPoints(type) {
    const points = { squid: 30, crab: 20, octopus: 10 };
    return points[type] || 10;
  }

  /**
   * Get bullet destruction bonus
   */
  static getBulletBonus() {
    return 5;
  }
}
