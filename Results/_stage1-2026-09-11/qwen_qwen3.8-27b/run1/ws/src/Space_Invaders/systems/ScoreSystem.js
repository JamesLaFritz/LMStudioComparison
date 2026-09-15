import { CONFIG } from '../config.js';

const HI_KEY = 'neon_invaders_hi';

/**
 * ScoreSystem — score, combo multiplier, extra lives, hi-score persistence.
 */
export class ScoreSystem {
  constructor() {
    this.score = 0;
    this.hiScore = this._loadHi();
    this.combo = 0;
    this.multiplier = 1;
    this.lives = CONFIG.START_LIVES;
    this.extraLifeAt = CONFIG.EXTRA_LIFE_FIRST;
    this.extraLifeStep = CONFIG.EXTRA_LIFE_STEP;
    this.wave = 1;
  }

  _loadHi() {
    try {
      const v = parseInt(localStorage.getItem(HI_KEY), 10);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch {
      return 0;
    }
  }

  _saveHi() {
    try {
      localStorage.setItem(HI_KEY, String(this.hiScore));
    } catch {
      /* storage unavailable — ignore */
    }
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.lives = CONFIG.START_LIVES;
    this.extraLifeAt = CONFIG.EXTRA_LIFE_FIRST;
    this.wave = 1;
  }

  /**
   * Add a kill. Returns { gained, multiplier, extraLife }.
   */
  addKill(baseValue) {
    this.combo++;
    this.multiplier = Math.min(CONFIG.COMBO.max, 1 + Math.floor(this.combo / 4) * 0.25);
    const gained = Math.round(baseValue * this.multiplier);
    this.score += gained;
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      this._saveHi();
    }
    let extraLife = false;
    if (this.score >= this.extraLifeAt) {
      this.lives = Math.min(9, this.lives + 1);
      this.extraLifeAt += this.extraLifeStep;
      extraLife = true;
    }
    return { gained, multiplier: this.multiplier, extraLife };
  }

  /**
   * Add a flat score (e.g. the UFO) without touching the combo.
   * @returns {number} the amount added
   */
  addScore(value) {
    this.score += value;
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      this._saveHi();
    }
    return value;
  }

  /** A missed bullet (left field / hit bunker) resets the combo. */
  miss() {
    this.combo = 0;
    this.multiplier = 1;
  }

  /**
   * Player was hit. Returns true if this was the final life.
   */
  loseLife() {
    this.lives--;
    this.combo = 0;
    this.multiplier = 1;
    return this.lives <= 0;
  }

  nextWave() {
    this.wave++;
  }
}
