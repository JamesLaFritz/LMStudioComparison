import { Vector3 } from '../../../shared/utils/math.js';

/**
 * GameLogic - Manages game state, scoring, wave progression, and player health.
 */
export class GameLogic {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.waveNumber = 1;
    this.playerHealth = 10;
    this.gameOver = false;
    this.aliensRemaining = 55;
    this.killsInWave = 0;
    this.comboMultiplier = 1.0;
    this.lastKillTime = performance.now();
  }

  /**
   * Update alien positions and movement based on player position.
   */
  updateEnemies(deltaTime, playerPosition) {
    // Alien movement logic would be handled by enemy entities directly
    // This method exists for API compatibility with main.js
  }

  /**
   * Add score for killing an alien based on row and type.
   */
  addAlienKill(row, type) {
    const now = performance.now();
    
    // Combo system - chain kills within 5 seconds
    if (now - this.lastKillTime < 5000) {
      this.comboMultiplier = Math.min(3.0, this.comboMultiplier + 0.1);
    } else {
      this.comboMultiplier = 1.0;
    }
    
    this.lastKillTime = now;
    
    // Base points by row (higher rows = more valuable)
    let basePoints = (5 - row) * 10;
    if (basePoints < 10) basePoints = 10;
    
    // Apply combo multiplier
    const points = Math.floor(basePoints * this.comboMultiplier);
    
    this.score += points;
    this.killsInWave++;
    this.aliensRemaining--;
    
    return points;
  }

  /**
   * Start the next wave of aliens.
   */
  startNextWave() {
    this.waveNumber++;
    this.killsInWave = 0;
    this.aliensRemaining = 55; // Reset alien count for new wave
    
    // Bonus points for clearing wave
    const bonus = this.waveNumber * 100;
    this.score += bonus;
    
    console.log(`Wave ${this.waveNumber} starting!`);
  }

  /**
   * Apply damage to player.
   */
  takeDamage(amount = 1) {
    if (this.gameOver) return false;
    
    this.playerHealth -= amount;
    
    if (this.playerHealth <= 0) {
      this.playerHealth = 0;
      this.gameOver = true;
    }
    
    return !this.gameOver;
  }

  /**
   * Heal player.
   */
  heal(amount = 1) {
    if (this.gameOver) return false;
    
    const oldHealth = this.playerHealth;
    this.playerHealth = Math.min(10, this.playerHealth + amount);
    
    return this.playerHealth > oldHealth;
  }

  /**
   * Check if game is over.
   */
  isGameOver() {
    return this.gameOver || this.playerHealth <= 0;
  }

  /**
   * Check win condition (wave 10+ cleared).
   */
  hasWon() {
    return this.waveNumber >= 10 && this.aliensRemaining === 55;
  }

  /**
   * Get player health percentage.
   */
  getHealthPercent() {
    return (this.playerHealth / 10) * 100;
  }
}
