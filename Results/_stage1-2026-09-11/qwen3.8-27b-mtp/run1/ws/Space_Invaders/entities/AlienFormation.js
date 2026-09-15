// AlienFormation — the 11×5 drone grid and its signature motion model.
//
// Classic behavior (plan §1.2): continuous X-march, discrete Z step-down on each
// wall bounce. Speed is a monotonic function of kills:
//   v = lerp(9, 84, pow(1 - aliveRatio, 1.6)) * waveMult(wave)
// so the swarm can never slow down mid-wave and the last alien is frantic.

import * as THREE from 'three';
import { clamp, lerp } from '../../shared/utils/math.js';
import { WORLD, GRID, ALIEN_RADIUS, FORMATION, waveVXMult } from '../config.js';
import { buildAlienFrames } from './AlienTypes.js';

// Destructured once at module scope — the rest of this file uses the short names.
const COLS = GRID.COLS;
const ROWS = GRID.ROWS;
const X_BOUND = WORLD.X_BOUND;
const PLAYER_Z = WORLD.PLAYER_Z;
const DEFENSE_MARGIN = WORLD.DEFENSE_MARGIN;

const FRAME_PERIOD_BASE = 0.72; // s between march-frame swaps at full grid
const FRAME_PERIOD_MIN = 0.34;  // …and when the swarm is frantic

export class AlienFormation {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../shared/materials/NeonMaterials.js').NeonMaterials} mats
   */
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;

    // Shared geometries: 3 types × 2 frames. Owned (and disposed) by this class.
    // Type indices: 0 = squid (30 pts), 1 = octopus (20), 2 = crab (10) — see AlienTypes.
    const squidA = buildAlienFrames(0, mats);
    const octoA = buildAlienFrames(1, mats);
    const crabA = buildAlienFrames(2, mats);
    this._geos = [squidA, octoA, crabA]; // each: { a, b }

    // Row → type mapping (plan §1.1): farthest rows are the 30-pt squids.
    const rowType = [2, 1, 1, 0, 0]; // z=-8→crab(2), -10/-12→octo(1), -14/-16→squid(0)

    this.slots = [];
    for (let r = 0; r < ROWS; r++) {
      const z = GRID.Z_START + r * GRID.ROW_SPACING; // -8 … -16
      const typeIdx = rowType[r];
      for (let c = 0; c < COLS; c++) {
        const x = -(COLS - 1) / 2 * GRID.COL_SPACING + c * GRID.COL_SPACING;
        const geoPair = this._geos[typeIdx];
        const mesh = new THREE.Mesh(geoPair.a, [mats.hull(), mats.neon()]);
        mesh.position.set(x, GRID.Y_BASE, z);
        scene.add(mesh);
        this.slots.push({ x, z, type: typeIdx, alive: true, mesh, phase: Math.random() * 6.28 });
      }
    }

    this.direction = 1;
    this._frameA = true;
    this._frameTimer = 0;
    this._t = 0; // hover-bob clock
    this.total = COLS * ROWS;
    this.aliveCount = this.total;
  }

  get aliveRatio() { return this.aliveCount / this.total; }
  get allDead() { return this.aliveCount === 0; }

  /** Current march speed (u/s) including wave scaling. */
  currentSpeed(wave) {
    const base = lerp(9, 84, Math.pow(1 - this.aliveRatio, 1.6));
    return base * waveVXMult(wave);
  }

  /**
   * Advance the formation one fixed step.
   * @returns {{steppedDown:boolean}} whether a wall bounce occurred this step
   */
  update(dt, wave) {
    const v = this.currentSpeed(wave);
    let steppedDown = false;

    // March X.
    for (const s of this.slots) {
      if (!s.alive) continue;
      s.x += this.direction * v * dt;
    }

    // Wall check on the live extremes only (dead slots never trigger bounces).
    let minX = Infinity, maxX = -Infinity;
    for (const s of this.slots) {
      if (!s.alive) continue;
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
    }

    if (this.direction > 0 && maxX + ALIEN_RADIUS >= X_BOUND) {
      this.direction = -1;
      steppedDown = true;
    } else if (this.direction < 0 && minX - ALIEN_RADIUS <= -X_BOUND) {
      this.direction = 1;
      steppedDown = true;
    }

    if (steppedDown) {
      // One discrete row-step toward the player line — the classic step-down.
      for (const s of this.slots) if (s.alive) s.z += GRID.STEP_DOWN;
    }

    // March-frame swap: period shrinks as the swarm accelerates (visual sync with audio tempo).
    const period = lerp(FRAME_PERIOD_BASE, FRAME_PERIOD_MIN, Math.pow(1 - this.aliveRatio, 1.5));
    this._frameTimer += dt;
    if (this._frameTimer >= period) {
      this._frameTimer = 0;
      this._toggleFrame();
    }

    // Hover bob — subtle life under the PBR rim lights.
    this._t += dt;
    for (const s of this.slots) {
      if (!s.alive) continue;
      const m = s.mesh;
      m.position.x = s.x;
      m.position.z = s.z;
      m.position.y = GRID.Y_BASE + Math.sin(this._t * 2.1 + s.phase) * 0.14;
    }

    return { steppedDown };
  }

  _toggleFrame() {
    this._frameA = !this._frameA;
    for (const s of this.slots) {
      if (!s.alive) continue;
      const pair = this._geos[s.type];
      s.mesh.geometry = this._frameA ? pair.a : pair.b;
    }
  }

  /** Kill one alien. Returns its slot (with type + position) for scoring/VFX. */
  kill(slot) {
    if (!slot.alive) return null;
    slot.alive = false;
    slot.mesh.visible = false;
    this.aliveCount--;
    return slot;
  }

  /** Lowest live alien (max z, i.e. closest to player) in a column — the fire source. */
  lowestInColumn(col) {
    let best = null;
    // Columns are implicit in slot order: index = row*COLS + col.
    for (let r = 0; r < ROWS; r++) {
      const idx = r * COLS + col;
      const s = this.slots[idx];
      if (s.alive && (!best || s.z > best.z)) best = s;
    }
    return best;
  }

  /** First live alien that has crossed the defense line, or null. */
  findLineCrosser() {
    const limit = PLAYER_Z - DEFENSE_MARGIN;
    for (const s of this.slots) if (s.alive && s.z >= limit) return s;
    return null;
  }

  /** Rebuild the full grid at wave start. */
  reset(wave) {
    void wave; // future: per-wave formation variants
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      const z = GRID.Z_START + r * GRID.ROW_SPACING;
      for (let c = 0; c < COLS; c++, i++) {
        const s = this.slots[i];
        s.x = -(COLS - 1) / 2 * GRID.COL_SPACING + c * GRID.COL_SPACING;
        s.z = z;
        s.alive = true;
        s.mesh.visible = true;
      }
    }
    this.direction = 1;
    this._frameA = true;
    this._frameTimer = 0;
    this.aliveCount = this.total;
    for (const s of this.slots) {
      const pair = this._geos[s.type];
      s.mesh.geometry = pair.a;
      s.mesh.position.set(s.x, GRID.Y_BASE, s.z);
    }
  }

  dispose() {
    for (const s of this.slots) this.scene.remove(s.mesh);
    for (const pair of this._geos) {
      pair.a.dispose();
      pair.b.dispose();
    }
  }
}
