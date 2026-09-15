// systems/Formation.js
// The 11×5 invader grid: marching, edge-turn, per-invader wobble, species mix.
// Owns the invader ObjectPool. Simulation state (anchor, dir, alive) lives here,
// NOT in the meshes — meshes are pure render adapters.

import { ObjectPool } from '../../shared/core/ObjectPool.js';
import { Invader } from '../entities/Invader.js';
import { CONFIG, SPECIES } from '../config.js';

const { COLS, ROWS, DX, DY, EDGE_X, DROP } = CONFIG;
const TOTAL = COLS * ROWS;

// Classic species layout: top rows = squid (30), middle = crab (20), bottom = octopus (10).
// Wave scaling shifts the mix toward higher-value species.
function speciesForRow(row, wave) {
  if (row <= 1) return 'squid';
  if (row <= 3) return wave >= 5 ? 'squid' : 'crab';
  return wave >= 5 ? 'squid' : wave >= 3 ? 'crab' : 'octopus';
}

export class Formation {
  constructor(scene) {
    this.scene = scene;
    this.pool = new ObjectPool(
      () => new Invader(scene),
      TOTAL,
      (inv) => inv.hide()
    );
    this.invaders = []; // active references (pool._active mirror for O(1) access)
    this.anchorX = 0;
    this.anchorY = 0;
    this.dir = 1;
    this.wave = 1;
    this.waveManager = null; // injected by main.js (single source of wave scaling)
    this.alive = 0;
    this._colBottom = new Int16Array(COLS); // row index of bottom-most alive invader per column (-1 = none)
  }

  /** (Re)build the full grid for a wave. Releases any active invaders first. */
  reset(wave) {
    this.wave = wave;
    this.pool.releaseAll();
    this.invaders.length = 0;
    this.anchorX = 0;
    this.anchorY = CONFIG.FORMATION_START_Y;
    this.dir = 1;
    this.alive = 0;
    this._colBottom.fill(-1);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const inv = this.pool.acquire();
        if (!inv) break;
        const species = speciesForRow(row, wave);
        inv.setup(species, col, row);
        inv.setOffsets((col - (COLS - 1) / 2) * DX, (row - (ROWS - 1) / 2) * DY);
        this.invaders.push(inv);
        this.alive++;
        this._colBottom[col] = row;
      }
    }
  }

  get aliveCount() { return this.alive; }
  get isCleared() { return this.alive === 0; }

  /** March speed: classic pressure curve — faster as the formation thins, scaled by wave. */
  get marchSpeed() {
    const thinning = 1 + 0.9 * (1 - this.alive / TOTAL);
    return this.waveManager.marchSpeed() * thinning;
  }

  /**
   * Advance the formation.
   * @returns {boolean} true if the formation dropped a row this frame (for VFX/audio)
   */
  update(dt, elapsed) {
    if (this.alive === 0) return false;

    this.anchorX += this.dir * this.marchSpeed * dt;

    // Edge turn: formation half-width is (COLS-1)/2 * DX.
    const halfW = ((COLS - 1) / 2) * DX;
    let dropped = false;
    if (this.dir > 0 && this.anchorX + halfW > EDGE_X) {
      this.anchorX = EDGE_X - halfW;
      this.dir = -1;
      this.anchorY -= DROP;
      dropped = true;
    } else if (this.dir < 0 && this.anchorX - halfW < -EDGE_X) {
      this.anchorX = -EDGE_X + halfW;
      this.dir = 1;
      this.anchorY -= DROP;
      dropped = true;
    }

    // Write world positions (anchor + grid offset + living wobble).
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      const wob = Math.sin(elapsed * CONFIG.WOBBLE_FREQ + inv.phase) * CONFIG.WOBBLE_AMP;
      inv.x = this.anchorX + inv.colOffset + wob;
      inv.y = this.anchorY + inv.rowOffset;
      inv.aabb.x = inv.x;
      inv.aabb.y = inv.y;
      inv.syncMesh();
      inv.animate(elapsed);
    }
    return dropped;
  }

  /** Mark an invader dead. Returns its species + grid info for scoring/VFX. */
  kill(inv) {
    if (!inv.alive) return null;
    inv.hide();
    this.pool.release(inv);
    const i = this.invaders.indexOf(inv);
    if (i !== -1) this.invaders.splice(i, 1);
    this.alive--;
    // Repair column bottom pointer.
    let bottom = -1;
    for (const other of this.invaders) {
      if (other.col === inv.col && other.row > bottom) bottom = other.row;
    }
    this._colBottom[inv.col] = bottom;
    return { species: inv.species, x: inv.x, y: inv.y, col: inv.col, row: inv.row, value: SPECIES[inv.species].value };
  }

  /** Bottom-most alive invader in a column (the shooter), or null. */
  bottomInColumn(col) {
    const row = this._colBottom[col];
    if (row < 0) return null;
    for (const inv of this.invaders) {
      if (inv.col === col && inv.row === row) return inv;
    }
    return null;
  }

  /** Invasion: any invader reached the player line. */
  hasInvaded(playerY) {
    for (const inv of this.invaders) {
      if (inv.alive && inv.y <= playerY + 0.6) return true;
    }
    return false;
  }

  forEach(fn) {
    for (const inv of this.invaders) fn(inv);
  }

  dispose() {
    this.pool.dispose();
    // Invader meshes are children of the scene; Engine.dispose() frees their GPU resources.
  }
}
