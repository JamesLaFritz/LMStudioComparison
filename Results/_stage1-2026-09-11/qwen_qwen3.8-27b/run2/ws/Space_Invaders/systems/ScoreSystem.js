import { CONFIG } from '../config.js';

/**
 * ScoreSystem — score, combo multiplier, lives, 1UP, wave.
 * Pure state + logic; the game calls the mutators and reads the getters.
 * No DOM, no three.js — fully testable in isolation.
 */
export class ScoreSystem {
  constructor() {
    this.score = 0;
    this.lives = CONFIG.scoring.startLives;
    this.wave = 1;
    this.kills = 0;
    this.combo = 0;          // consecutive kills within the window
    this.comboTimer = 0;     // s remaining in the combo window
    this.multiplier = 1;
    this._nextOneUp = CONFIG.scoring.oneUpEvery;
    this._oneUpPending = false;
  }

  reset() {
    this.score = 0;
    this.lives = CONFIG.scoring.startLives;
    this.wave = 1;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this._nextOneUp = CONFIG.scoring.oneUpEvery;
    this._oneUpPending = false;
  }

  /** Advance the combo window; returns true if the multiplier just dropped. */
  update(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.multiplier = 1;
        return true;
      }
    }
    return false;
  }

  /**
   * Register a kill worth `base` points. Returns the actual points awarded
   * (base × multiplier) and updates combo/multiplier/1UP.
   */
  addKill(base) {
    this.kills++;
    this.combo++;
    this.comboTimer = CONFIG.scoring.comboWindow;
    const tier = Math.floor(this.combo / CONFIG.scoring.comboStep);
    this.multiplier = Math.min(1 + tier, CONFIG.scoring.maxMultiplier);
    const awarded = base * this.multiplier;
    this.score += awarded;
    if (this.score >= this._nextOneUp) {
      this._nextOneUp += CONFIG.scoring.oneUpEvery;
      this._oneUpPending = true;
    }
    return awarded;
  }

  /** Consume a pending 1UP (game grants the life + plays the jingle). */
  consumeOneUp() {
    if (!this._oneUpPending) return false;
    this._oneUpPending = false;
    this.lives++;
    return true;
  }

  loseLife() {
    this.lives--;
    this.combo = 0;
    this.multiplier = 1;
    this.comboTimer = 0;
  }

  nextWave() {
    this.wave++;
  }

  get isGameOver() { return this.lives <= 0; }
  get oneUpPending() { return this._oneUpPending; }
}
