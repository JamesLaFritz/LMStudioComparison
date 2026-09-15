import { createRng } from '@shared/math/rng.js';
import { CONFIG } from '../config.js';

/**
 * SpawnerSystem — owns all timed spawning: invader bombs and the UFO.
 * Seeded RNG (createRng) for reproducible waves.
 *
 * `update()` returns a single event object (or null):
 *   { type: 'bomb', x, z, speed }   — spawn a bomb at (x, z)
 *   { type: 'ufo' }                 — spawn the UFO (it picks its own score)
 */
export class SpawnerSystem {
  constructor(seed = 0x51a7) {
    this.rng = createRng(seed);
    this.bombTimer = 2.0;
    this.ufoTimer = 14;
  }

  reset(seed) {
    this.rng = createRng(seed >>> 0);
    this.bombTimer = 2.0;
    this.ufoTimer = 12 + this.rng.next() * 8;
  }

  /**
   * Advance timers.
   * @param {number} dt
   * @param {object} formation — InvaderFormation
   * @param {number} wave
   * @returns {object|null}
   */
  update(dt, formation, wave) {
    if (formation.liveCount === 0) return null;

    // Bomb timer.
    this.bombTimer -= dt;
    if (this.bombTimer <= 0) {
      const t = 1 - formation.liveCount / CONFIG.INVADERS.total;
      const interval =
        (CONFIG.BOMBS.intervalMax -
          (CONFIG.BOMBS.intervalMax - CONFIG.BOMBS.intervalMin) * t) /
        (1 + 0.1 * (wave - 1));
      this.bombTimer = interval * (0.7 + this.rng.next() * 0.6);

      const idx = this._pickBottomWeighted(formation);
      if (idx >= 0) {
        const p = formation.invaderXZ(idx);
        const speed =
          CONFIG.BOMBS.speedMin +
          (CONFIG.BOMBS.speedMax - CONFIG.BOMBS.speedMin) * t +
          1.5 * (wave - 1);
        return { type: 'bomb', x: p.x, z: p.z, speed };
      }
    }

    // UFO timer.
    this.ufoTimer -= dt;
    if (this.ufoTimer <= 0) {
      this.ufoTimer = 12 + this.rng.next() * 8;
      return { type: 'ufo' };
    }

    return null;
  }

  /** Weighted pick favoring the bottom rows (classic behavior). */
  _pickBottomWeighted(formation) {
    const weights = CONFIG.INVADERS.BOMB_ROW_WEIGHTS; // row 0 (top) → row 4 (bottom)
    const live = formation.liveList;
    if (live.length === 0) return -1;
    const pool = [];
    for (const idx of live) {
      const row = formation.invaderType(idx);
      const w = weights[row] ?? 1;
      for (let i = 0; i < w; i++) pool.push(idx);
    }
    return pool[Math.floor(this.rng.next() * pool.length)] ?? -1;
  }
}
