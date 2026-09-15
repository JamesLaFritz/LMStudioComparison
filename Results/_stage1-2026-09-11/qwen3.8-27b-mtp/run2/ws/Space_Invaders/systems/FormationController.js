import { clamp, lerp } from '../../shared/math/MathUtils.js';
import CONFIG from '../config.js';

/**
 * Rigid-body formation kinematics: the whole grid is one body (anchor + direction).
 * Speed law: speedMult = lerp(min, max, 1 - alive/total) — continuous acceleration as it thins.
 * Firing: each step, p = clamp(base + waveRamp + thin*thinK); per-column lowest live cell fires.
 */
export class FormationController {
  constructor({ invaderPool, bombPool }) {
    this.invaderPool = invaderPool;
    this.bombPool = bombPool;

    this.cols = CONFIG.formation.cols;
    this.rows = CONFIG.formation.rows;
    this.spacingX = CONFIG.formation.spacingX;
    this.spacingY = CONFIG.formation.spacingY;

    this.anchorX = 0;
    this.anchorY = CONFIG.formation.startY;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.stepTimer = 0;
    this.stompFrame = 0;
    this.total = 0;
    this.alive = 0;
    this.wave = 1;

    // Per-column lowest live row (for firing) — recomputed lazily.
    this._lowestRow = new Array(this.cols).fill(-1);
  }

  /** Reset the formation for a given wave. Spawns all units from the pool. */
  reset(wave) {
    this.wave = wave;
    // Release any live invaders + bombs back to their pools (hidden via releaseAll reset).
    this.invaderPool.releaseAll();
    this.bombPool.releaseAll();

    this.anchorX = 0;
    this.anchorY = CONFIG.formation.startY;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.stepTimer = 0;
    this.stompFrame = 0;
    this.total = this.cols * this.rows;
    this.alive = this.total;

    for (let r = 0; r < this.rows; r++) {
      const species = r === 0 ? 'squid' : (r <= 2 ? 'crab' : 'octopus');
      for (let c = 0; c < this.cols; c++) {
        const inv = this.invaderPool.acquire();
        if (!inv) continue; // pool exhausted — should not happen at capacity
        inv.spawn(species, r, c);
        this._place(inv, r, c);
      }
    }
  }

  _place(inv, row, col) {
    const x = this.anchorX + (col - (this.cols - 1) / 2) * this.spacingX;
    const y = this.anchorY - row * this.spacingY;
    inv.position.set(x, y, 0);
  }

  /** Reposition every live invader from anchor + grid offset. */
  _layout() {
    for (const inv of this.invaderPool.activeList) {
      if (!inv.alive) continue;
      this._place(inv, inv.row, inv.col);
    }
  }

  speedMultiplier() {
    const thin = this.total > 0 ? (this.total - this.alive) / this.total : 1;
    return lerp(CONFIG.formation.minSpeedMult, CONFIG.formation.maxSpeedMult, thin);
  }

  stepInterval() {
    const waveRamp = 1 + (this.wave - 1) * CONFIG.waves.speedRampPerWave;
    return CONFIG.formation.stepBase / (this.speedMultiplier() * waveRamp);
  }

  /** True if any live invader has reached (or passed) the shield line — player loses. */
  hasBreached() {
    const limit = CONFIG.arena.shieldLineY;
    for (const inv of this.invaderPool.activeList) {
      if (!inv.alive) continue;
      if (inv.position.y <= limit) return true;
    }
    return false;
  }

  hasAlive() {
    return this.alive > 0;
  }

  /** Mark an invader dead. Returns its species + points for scoring/VFX. */
  kill(inv) {
    if (!inv.alive) return null;
    inv.deactivate();
    this.alive--;
    return { species: inv.species, points: inv.points };
  }

  /** Advance the march. `firing` gates enemy fire (attract mode passes false). */
  update(dt, firing = true) {
    if (this.alive === 0) return;

    this.stepTimer += dt;
    const interval = this.stepInterval();
    let stepped = false;

    while (this.stepTimer >= interval && this.alive > 0) {
      this.stepTimer -= interval;
      this._doStep(firing);
      stepped = true;
    }

    if (!stepped) return;

    // Stomp animation: two-frame silhouette swap, synced to steps.
    this.stompFrame ^= 1;
    for (const inv of this.invaderPool.activeList) {
      if (inv.alive) inv.setStomp(this.stompFrame);
    }
  }

  _doStep(firing) {
    const margin = 0.6;
    // Outermost live column offset from anchor.
    let maxOffset = 0;
    for (const inv of this.invaderPool.activeList) {
      if (!inv.alive) continue;
      const off = Math.abs(inv.col - (this.cols - 1) / 2) * this.spacingX;
      if (off > maxOffset) maxOffset = off;
    }

    const nextAx = this.anchorX + this.dir * (this.spacingX * 0.5);
    if (nextAx + maxOffset > CONFIG.arena.halfWidth - margin || nextAx - maxOffset < -CONFIG.arena.halfWidth + margin) {
      // Hit the wall: drop and reverse.
      this.anchorY -= CONFIG.formation.dropAmount;
      this.dir *= -1;
    } else {
      this.anchorX = nextAx;
    }

    this._layout();

    if (!firing || this.alive === 0) return;

    // Firing: probability scales with thinning + wave.
    const thin = (this.total - this.alive) / Math.max(1, this.total);
    const p = clamp(
      CONFIG.formation.fireProbBase +
      (this.wave - 1) * CONFIG.waves.fireProbRampPerWave +
      0.5 * thin,
      0.12, CONFIG.formation.fireProbMax
    );
    if (Math.random() >= p) return;

    // Fire from up to N random columns' lowest live cell.
    const maxShots = Math.min(3 + this.wave, 6);
    let fired = 0;
    for (let attempt = 0; attempt < maxShots * 2 && fired < maxShots; attempt++) {
      const col = (Math.random() * this.cols) | 0;
      // Find lowest live row in this column.
      let shooter = null;
      for (const inv of this.invaderPool.activeList) {
        if (!inv.alive || inv.col !== col) continue;
        if (!shooter || inv.row > shooter.row) shooter = inv;
      }
      if (!shooter) continue;
      const bomb = this.bombPool.acquire();
      if (!bomb) break; // pool exhausted — stop firing this step
      const speed = CONFIG.bombs.speed + (this.wave - 1) * CONFIG.waves.bombSpeedRampPerWave;
      bomb.spawn(shooter.position.x, shooter.position.y - 0.5, -speed);
      fired++;
    }
  }

  /** Release everything back to the pools (teardown / state change). */
  clear() {
    this.invaderPool.releaseAll();
    this.bombPool.releaseAll();
    this.alive = 0;
  }
}
