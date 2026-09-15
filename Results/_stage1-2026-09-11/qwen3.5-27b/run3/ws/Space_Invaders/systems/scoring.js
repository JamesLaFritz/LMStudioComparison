/**
 * ScoringSystem - Manages score calculation, combo multiplier, high scores
 */

export class ScoringSystem {
  constructor() {
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('spaceInvadersHighScore')) || 0;
    this.comboMultiplier = 1;
    this.consecutiveKills = 0;
    this.maxCombo = 1;
    
    // Combo thresholds
    this.COMBO_THRESHOLD = 5; // Kills needed for x2 multiplier
    this.MAX_MULTIPLIER = 3;
    
    // Point values per alien type
    this.POINTS = {
      squid: 30,
      crab: 20,
      octopus: 10,
      ufo: 150
    };
  }

  /**
   * Add score from destroying an entity
   */
  addScore(entityType) {
    let points = this.POINTS[entityType] || 10;
    
    // UFO has randomized points (150-300)
    if (entityType === 'ufo') {
      points = Math.floor(Math.random() * 150) + 150;
    }
    
    // Apply combo multiplier
    const totalPoints = points * this.comboMultiplier;
    this.score += totalPoints;
    
    // Track consecutive kills for combo system
    if (entityType !== 'ufo') {
      this.consecutiveKills++;
      this.updateComboMultiplier();
      
      if (this.consecutiveKills > this.maxCombo) {
        this.maxCombo = this.consecutiveKills;
      }
    }
    
    return totalPoints;
  }

  /**
   * Update combo multiplier based on consecutive kills
   */
  updateComboMultiplier() {
    if (this.consecutiveKills >= this.COMBO_THRESHOLD * 2) {
      this.comboMultiplier = this.MAX_MULTIPLIER;
    } else if (this.consecutiveKills >= this.COMBO_THRESHOLD) {
      this.comboMultiplier = 2;
    } else {
      this.comboMultiplier = 1;
    }
  }

  /**
   * Reset combo on player taking damage
   */
  resetCombo() {
    this.consecutiveKills = 0;
    this.comboMultiplier = 1;
  }

  /**
   * Check if new high score achieved
   */
  checkHighScore() {
    return this.score >= this.highScore && this.score > 0;
  }

  /**
   * Save high score to localStorage
   */
  saveHighScore() {
    if (this.checkHighScore()) {
      this.highScore = this.score;
      localStorage.setItem('spaceInvadersHighScore', this.highScore.toString());
      return true;
    }
    return false;
  }

  /**
   * Get formatted score string for display
   */
  getFormattedScore() {
    return this.score.toLocaleString();
  }

  /**
   * Get formatted high score string
   */
  getFormattedHighScore() {
    return this.highScore.toLocaleString();
  }

  /**
   * Get combo display text
   */
  getComboText() {
    if (this.comboMultiplier > 1) {
      return `x${this.comboMultiplier} COMBO! (${this.consecutiveKills} kills)`;
    }
    return '';
  }

  /**
   * Reset scoring for new game
   */
  reset() {
    this.score = 0;
    this.comboMultiplier = 1;
    this.consecutiveKills = 0;
    this.maxCombo = 1;
  }

  /**
   * Get all score data for UI update
   */
  getData() {
    return {
      score: this.score,
      highScore: this.highScore,
      comboMultiplier: this.comboMultiplier,
      consecutiveKills: this.consecutiveKills,
      maxCombo: this.maxCombo
    };
  }
}
