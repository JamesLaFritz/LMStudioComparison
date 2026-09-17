// Score, combo multiplier, lives, extra-life thresholds, hi-score persistence and run statistics.
import { SCORING, PLAYER } from '../config.js';

function loadHiScore() {
  try {
    const raw = window.localStorage.getItem(SCORING.HISCORE_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function saveHiScore(value) {
  try {
    window.localStorage.setItem(SCORING.HISCORE_KEY, String(value));
  } catch {
    /* storage may be unavailable (private mode, sandbox) */
  }
}

export class ScoreSystem {
  /** @param {import('@shared/core/EventBus.js').EventBus} events */
  constructor(events) {
    this.events = events;
    this.hiScore = loadHiScore();
    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = PLAYER.LIVES;
    this.chain = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this.nextExtraLife = SCORING.EXTRA_LIFE_FIRST;
    this.stats = { shots: 0, hits: 0, kills: 0, ufoKills: 0, time: 0, wavesCleared: 0, bunkerCells: 0 };
    this._hiDirty = false;
  }

  get comboProgress() {
    return this.comboTimer > 0 ? this.comboTimer / SCORING.COMBO_WINDOW : 0;
  }

  get accuracy() {
    return this.stats.shots > 0 ? Math.min(1, this.stats.hits / this.stats.shots) : 0;
  }

  static multiplierFor(chain) {
    if (chain >= 9) return 4;
    if (chain >= 6) return 3;
    if (chain >= 3) return 2;
    return 1;
  }

  recordShot(count = 1) {
    this.stats.shots += count;
  }

  /** Register an invader kill; returns the points actually awarded and the multiplier used. */
  addKill(basePoints, position = null) {
    this.chain++;
    this.comboTimer = SCORING.COMBO_WINDOW;
    this.multiplier = ScoreSystem.multiplierFor(this.chain);
    this.stats.kills++;
    this.stats.hits++;
    const award = basePoints * this.multiplier;
    this.addScore(award, position);
    return { award, multiplier: this.multiplier, chain: this.chain };
  }

  addScore(points, position = null) {
    if (points <= 0) return;
    this.score += points;
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      this._hiDirty = true;
    }
    while (this.score >= this.nextExtraLife) {
      this.nextExtraLife += SCORING.EXTRA_LIFE_EVERY;
      if (this.lives < PLAYER.MAX_LIVES) {
        this.lives++;
        this.events.emit('life:extra', { lives: this.lives, position });
      }
    }
    this.events.emit('score:changed', { score: this.score, delta: points, multiplier: this.multiplier, position });
  }

  loseLife() {
    this.lives = Math.max(0, this.lives - 1);
    this.chain = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    return this.lives;
  }

  update(dt) {
    this.stats.time += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.chain = 0;
        this.multiplier = 1;
      }
    }
  }

  /** Persist the hi-score if it changed (call at game over / victory / teardown). */
  flush() {
    if (this._hiDirty) {
      saveHiScore(this.hiScore);
      this._hiDirty = false;
    }
  }
}
