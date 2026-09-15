// Space_Invaders/systems/Spawner.js
// Stochastic invader fire (weighted toward bottom rows) + UFO scheduling.
// All bullets come from the shared ObjectPools — zero allocation in steady state.
//
// Fire model: a probability accumulator. Each frame we add fireRate*dt; whenever
// the accumulator crosses 1 we fire one bolt. This gives a smooth, rate-based
// stream (not a fixed metronome) and naturally thins when the pool is full.
//
// Wave scaling (fire rate, bullet speed) is sourced from WaveManager — the single
// source of truth — so Spawner never duplicates the scaling curves.

import { CONFIG } from '../config.js';

export class Spawner {
  /**
   * @param {object} formation     Formation instance (source of alive invaders)
   * @param {object} invaderBullets ObjectPool of InvaderBullet
   * @param {object} ufo           UFO entity
   * @param {object} audio         AudioEngine
   * @param {object} waveManager   WaveManager (fire-rate + bullet-speed scaling)
   */
  constructor(formation, invaderBullets, ufo, audio, waveManager) {
    this.formation = formation;
    this.invaderBullets = invaderBullets;
    this.ufo = ufo;
    this.audio = audio;
    this.waveManager = waveManager;

    this.fireAccum = 0;      // probability accumulator
    this.ufoTimer = this._randUfoDelay();
  }

  _randUfoDelay() {
    return CONFIG.UFO_INTERVAL_MIN + Math.random() * (CONFIG.UFO_INTERVAL_MAX - CONFIG.UFO_INTERVAL_MIN);
  }

  /** @param {number} dt seconds */
  update(dt) {
    // --- Invader fire -----------------------------------------------------
    const fireRate = this.waveManager.fireRate();
    this.fireAccum += fireRate * dt;
    while (this.fireAccum >= 1) {
      this.fireAccum -= 1;
      this._fireOne();
    }

    // --- UFO scheduling ---------------------------------------------------
    this.ufoTimer -= dt;
    if (this.ufoTimer <= 0) {
      if (!this.ufo.active) this._spawnUfo();
      this.ufoTimer = this._randUfoDelay();
    }
  }

  _fireOne() {
    const shooter = this._pickShooter();
    if (!shooter) return;
    const b = this.invaderBullets.acquire();
    if (!b) return; // pool exhausted — skip this shot
    const speed = this.waveManager.bulletSpeed();
    b.spawn(shooter.x, shooter.y - 0.4, -speed);
  }

  _pickShooter() {
    // Bottom-most alive invader per column, weighted by row (bottom rows fire more).
    const byCol = new Map();
    for (const inv of this.formation.invaders) {
      if (!inv.alive) continue;
      const cur = byCol.get(inv.col);
      if (!cur || inv.row > cur.row) byCol.set(inv.col, inv);
    }
    const cands = Array.from(byCol.values());
    if (!cands.length) return null;
    let total = 0;
    for (const c of cands) total += (c.row + 1);
    let r = Math.random() * total;
    for (const c of cands) {
      r -= (c.row + 1);
      if (r <= 0) return c;
    }
    return cands[cands.length - 1];
  }

  _spawnUfo() {
    const fromLeft = Math.random() < 0.5;
    this.ufo.spawn(fromLeft ? 1 : -1);
    this.audio.startUfoLoop();
  }

  reset() {
    this.fireAccum = 0;
    this.ufoTimer = this._randUfoDelay();
  }
}
