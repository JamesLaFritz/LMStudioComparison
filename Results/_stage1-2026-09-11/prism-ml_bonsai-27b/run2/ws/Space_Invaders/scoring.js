/**
 * Scoring System for Space Invaders
 * Handles score tracking, lives management, wave progression, and high score persistence.
 */

import { vec3 } from '../shared/utils/math.js';

// --- Constants ---
const ALIEN_POINTS = {
  SQUID: 30,    // Top row (row 0)
  CRAB: 20,     // Middle rows (rows 1-3)
  OCTOPUS: 10   // Bottom rows (rows 4+)
};

const ALIEN_COLORS = {
  SQUID: '#00ffff',    // Cyan
  CRAB: '#ff00ff',     // Magenta
  OCTOPUS: '#ffff00'   // Yellow
};

const ALIEN_TYPES = ['SQUID', 'CRAB', 'OCTOPUS'];

// --- State ---
let score = 0;
let lives = 3;
let waveNumber = 1;
let highScore = parseInt(localStorage.getItem('spaceInvadersHighScore')) || 0;
let isGameActive = false;
let isGameOver = false;
let isPaused = false;

// --- Public API ---

/**
 * Initialize scoring system. Call once at game start.
 */
export function initScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get current score.
 */
export function getScore() {
  return score;
}

/**
 * Get current lives count.
 */
export function getLives() {
  return lives;
}

/**
 * Get current wave number.
 */
export function getWaveNumber() {
  return waveNumber;
}

/**
 * Get high score.
 */
export function getHighScore() {
  return highScore;
}

/**
 * Check if game is active (not over and not paused).
 */
export function isActive() {
  return isGameActive && !isGameOver && !isPaused;
}

/**
 * Mark game as over. Updates high score if needed.
 */
export function markGameOver() {
  isGameOver = true;
  isGameActive = false;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('spaceInvadersHighScore', highScore);
  }
}

/**
 * Mark game as paused.
 */
export function setPaused(paused) {
  isPaused = paused;
}

/**
 * Add points to the score.
 * @param {number} points - Points to add (positive or negative for penalties).
 */
export function addScore(points) {
  if (!isGameActive || isGameOver) return;
  score += points;
}

/**
 * Lose a life. Returns true if player has no lives remaining.
 */
export function loseLife() {
  if (!isGameActive || isGameOver) return false;
  lives--;
  if (lives <= 0) {
    markGameOver();
    return true;
  }
  return false;
}

/**
 * Check if player has any lives remaining.
 */
export function hasLives() {
  return lives > 0 && isGameActive && !isGameOver;
}

/**
 * Get the points value for an alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for an alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getVelocityMultiplier(waveNumber) {
  // Base velocity increases with each wave
  return 1 + (waveNumber - 1) * 0.3;
}

/**
 * Get the shooting probability for an alien type on a given wave.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 * @param {number} waveNumber - The current wave number.
 */
export function getShootingProbability(type, waveNumber) {
  const baseProb = ALIEN_TYPES.indexOf(type); // SQUID=0, CRAB=1, OCTOPUS=2
  return Math.min(0.3 + (baseProb * 0.05) + ((waveNumber - 1) * 0.02), 0.9);
}

/**
 * Check if the current wave is complete (all aliens destroyed).
 */
export function isWaveComplete() {
  return getScore() >= getHighScore(); // Placeholder; actual check done in game logic
}

/**
 * Get the score display string for the HUD.
 */
export function getScoreDisplay() {
  return score.toString().padStart(8, '0');
}

/**
 * Get the lives display count.
 */
export function getLivesDisplay() {
  return lives;
}

/**
 * Get the wave announcement string.
 */
export function getWaveAnnouncement() {
  return `WAVE ${waveNumber}`;
}

/**
 * Reset scoring for a new game.
 */
export function resetScoring() {
  score = 0;
  lives = 3;
  waveNumber = 1;
  isGameActive = true;
  isGameOver = false;
  isPaused = false;
}

/**
 * Get the current game state summary.
 * @returns {object} Summary of scoring state.
 */
export function getGameStateSummary() {
  return {
    score,
    lives,
    waveNumber,
    highScore,
    isActive: isGameActive && !isGameOver && !isPaused,
    isGameOver,
    isPaused
  };
}

/**
 * Get the points value for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienPoints(type) {
  return ALIEN_POINTS[type] || 0;
}

/**
 * Get the color for a specific alien type.
 * @param {string} type - Alien type: 'SQUID', 'CRAB', or 'OCTOPUS'.
 */
export function getAlienColor(type) {
  return ALIEN_COLORS[type] || '#ffffff';
}

/**
 * Get the number of rows for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getRowsForWave(waveNumber) {
  // Wave 1: 5 rows, each with 11 aliens
  // Each subsequent wave adds more aliens per row
  return Math.min(5, 2 + Math.floor((waveNumber - 1) * 0.8));
}

/**
 * Get the number of columns for a given wave.
 * @param {number} waveNumber - The current wave number.
 */
export function getColumnsForWave(waveNumber) {
  return 11; // Fixed at 11 columns per row
}

/**
 * Calculate the total number of aliens in the current wave.
 * @returns {number} Total alien count.
 */
export function getTotalAliens() {
  const rows = getRowsForWave(waveNumber);
  return rows * getColumnsForWave(waveNumber);
}

/**
 * Get the base velocity multiplier for the current wave.
 * @param {number} waveNumber - The current wave number.