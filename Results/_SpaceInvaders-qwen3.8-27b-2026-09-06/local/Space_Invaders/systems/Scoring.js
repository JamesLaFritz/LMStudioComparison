// Space_Invaders/systems/Scoring.js
// Score, combo multiplier, wave bonus, high score (localStorage).
// Pure state — no Three.js, no DOM. HUD is updated by main.js.

import { SCORE, COMBO } from '../config.js';

const HS_KEY = 'si_highscore_v1';

export class Scoring {
  constructor() {
    this.score = 0;
    this.combo = 0;
    this.best = this._loadBest();
  }

  get multiplier() {
    return Math.min(COMBO.max, 1 + this.combo * COMBO.step);
  }

  /**
   * Add a kill. Returns the final awarded points (after combo).
   * @param {number} base  species base value
   * @param {boolean} [bonus=false]  wave-clear bonus kill
   */
  addKill(base, bonus = false) {
    const mult = this.multiplier;
    const awarded = Math.round((base + (bonus ? SCORE.waveBonus : 0)) * mult);
    this.score += awarded;
    this.combo = Math.min(this.combo + 1, 99);
    if (this.score > this.best) this.best = this.score;
    return awarded;
  }

  /** UFO kill — high value, does not extend combo (it's a bonus target). */
  addUfo(value) {
    this.score += value;
    if (this.score > this.best) this.best = this.score;
    return value;
  }

  /** Player got hit — combo resets. */
  resetCombo() {
    this.combo = 0;
  }

  /** New wave — combo carries over (classic streak), nothing else. */
  onWave() {
    // Intentionally no reset: streaks are a reward for clean waves.
  }

  isRecord() {
    return this.score >= this.best && this.score > 0;
  }

  _loadBest() {
    try {
      const v = parseInt(localStorage.getItem(HS_KEY), 10);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch {
      return 0;
    }
  }

  saveBest() {
    try {
      localStorage.setItem(HS_KEY, String(this.best));
    } catch {
      // storage unavailable (private mode) — best stays in-memory
    }
  }

  reset() {
    this.score = 0;
    this.combo = 0;
  }
}
