/**
 * Difficulty System - Wave progression, speed scaling, spawn rate adjustment
 */

export class DifficultySystem {
  constructor() {
    this.wave = 1;
    
    // Base values (scale with wave)
    this.baseAlienSpeed = 0.8;
    this.baseBombRate = 0.002; // Per-frame probability per alien
    
    // Scaling factors
    this.speedScalePerWave = 1.15;
    this.bombRateScalePerWave = 1.2;
    
    // UFO spawn timing (seconds)
    this.ufoMinInterval = 15;
    this.ufoMaxInterval = 25;
    this.ufoIntervalScale = 0.95; // Gets slightly faster per wave
    
    // Current computed values
    this.currentAlienSpeed = this.baseAlienSpeed;
    this.currentBombRate = this.baseBombRate;
    this.currentUfoMinInterval = this.ufoMinInterval;
    this.currentUfoMaxInterval = this.ufoMaxInterval;
    
    this.recalculate();
  }

  /**
   * Recalculate all difficulty values based on current wave
   */
  recalculate() {
    const multiplier = Math.pow(this.speedScalePerWave, this.wave - 1);
    
    this.currentAlienSpeed = this.baseAlienSpeed * multiplier;
    this.currentBombRate = Math.min(this.baseBombRate * Math.pow(this.bombRateScalePerWave, this.wave - 1), 0.02);
    
    const ufoMultiplier = Math.pow(this.ufoIntervalScale, this.wave - 1);
    this.currentUfoMinInterval = Math.max(8, this.ufoMinInterval * ufoMultiplier);
    this.currentUfoMaxInterval = Math.max(12, this.ufoMaxInterval * ufoMultiplier);
  }

  /**
   * Advance to next wave
   */
  advanceWave() {
    this.wave++;
    this.recalculate();
    
    return {
      wave: this.wave,
      alienSpeed: this.currentAlienSpeed,
      bombRate: this.currentBombRate
    };
  }

  /**
   * Get UFO spawn interval range in seconds
   */
  getUfoInterval() {
    const min = this.currentUfoMinInterval;
    const max = this.currentUfoMaxInterval;
    
    return {
      min: min,
      max: max,
      random: Math.random() * (max - min) + min
    };
  }

  /**
   * Get bomb fire probability for a single alien this frame
   */
  getBombProbability(alienType) {
    // Different alien types have different base probabilities
    const typeMultiplier = {
      'squid': 0.8,
      'crab': 1.5,
      'octopus': 2.0
    };
    
    return this.currentBombRate * (typeMultiplier[alienType] || 1.0);
  }

  /**
   * Get speed multiplier based on remaining aliens (progressive acceleration)
   */
  getProgressiveSpeedMultiplier(remainingAliens, totalAliens) {
    const ratio = remainingAliens / totalAliens;
    
    // Speed increases as aliens are destroyed
    // At 100%: 1.0x, at 50%: 1.3x, at 0%: 2.0x
    return 1.0 + (1.0 - ratio) * 1.0;
  }

  /**
   * Get points multiplier for current wave
   */
  getPointsMultiplier() {
    // Slight bonus for higher waves
    return 1.0 + (this.wave - 1) * 0.1;
  }

  /**
   * Reset to initial difficulty
   */
  reset() {
    this.wave = 1;
    this.recalculate();
  }

  /**
   * Get current difficulty state for UI display
   */
  getState() {
    return {
      wave: this.wave,
      alienSpeed: Math.round(this.currentAlienSpeed * 100) / 100,
      bombRate: Math.round(this.currentBombRate * 1000) / 1000,
      ufoIntervalMin: Math.round(this.currentUfoMinInterval),
      ufoIntervalMax: Math.round(this.currentUfoMaxInterval)
    };
  }
}

export default DifficultySystem;
