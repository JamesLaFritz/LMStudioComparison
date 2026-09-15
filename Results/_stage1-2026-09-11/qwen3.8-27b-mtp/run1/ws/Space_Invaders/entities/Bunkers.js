// Space_Invaders/entities/Bunkers.js
// Destructible cover: 4 bunkers × ~80 live cells, ALL rendered by ONE InstancedMesh
// (single draw call). Erosion is symmetric — player and alien bullets carve identical
// craters. Dead cells are hidden with zero-scale matrices: no buffer rebuilds, no
// allocation in the hot path.

import * as THREE from 'three';
import { clamp } from '../../shared/utils/math.js';
import { BUNKERS } from '../config.js';

const COLS = 13;
const ROWS = 7;
const CELL = 0.42;
const CRATER_R = 1.15; // classic "bite" radius
const HALF_COLS = (COLS - 1) / 2;

// Arch cutout: cells inside this profile are never built (the entry notch).
function isArchCell(col, row) {
  if (row >= ROWS - 3 && col >= 4 && col <= 8) return true; // bottom-center opening
  if ((row === ROWS - 1 || row === ROWS - 2) && col >= 5 && col <= 7) return true;
  return false;
}

export class Bunkers {
  /**
   * @param scene THREE.Scene
   * @param mat THREE.Material — MeshStandardMaterial for the blocks (shared, owner disposes)
   */
  constructor(scene, mat) {
    this.scene = scene;

    // Cell grids: [bunker][row][col] → true when live.
    this.grids = [];
    const totalCells = BUNKERS.COUNT * COLS * ROWS;

    const geo = new THREE.BoxGeometry(CELL * 0.92, CELL * 0.8, CELL * 0.92);
    this._geo = geo;

    // One InstancedMesh for every block of every bunker (upper bound).
    const mesh = new THREE.InstancedMesh(geo, mat, totalCells);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
    this.mesh = mesh;

    // Flat cell index per instance slot (b*COLS*ROWS + r*COLS + c), -1 for unused tail.
    this._cellIndex = new Int32Array(totalCells).fill(-1);

    const m4 = new THREE.Matrix4();
    let idx = 0;
    for (let b = 0; b < BUNKERS.COUNT; b++) {
      const grid = [];
      const bx = BUNKERS.X_POSITIONS[b];
      for (let r = 0; r < ROWS; r++) {
        const rowArr = new Array(COLS).fill(false);
        for (let c = 0; c < COLS; c++) {
          if (isArchCell(c, r)) continue; // arch cutout — never built
          const x = bx + (c - HALF_COLS) * CELL;
          const y = BUNKERS.BASE_Y + r * CELL * 0.8;
          m4.makeTranslation(x, y, BUNKERS.Z);
          mesh.setMatrixAt(idx, m4);

          this._cellIndex[idx] = b * COLS * ROWS + r * COLS + c;
          rowArr[c] = true;
          idx++;
        }
        grid.push(rowArr);
      }
      this.grids.push(grid);
    }

    // Unused tail instances stay zero-scaled (hidden).
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = idx; i < totalCells; i++) mesh.setMatrixAt(i, zero);
    this._liveCount = idx; // instance slots that hold a real cell

    // Per-instance slight hue jitter: cyan → teal band.
    const col = new THREE.Color();
    for (let i = 0; i < this._liveCount; i++) {
      const t = Math.random() * 0.35;
      col.setRGB(0.1 + t * 0.2, 0.75 - t * 0.15, 0.9 - t * 0.2);
      mesh.setColorAt(i, col);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    this._m4 = m4;
    this.liveCells = idx; // live cell count for O(1) queries
  }

  /**
   * Erode all live cells whose centers fall within `radius` of the segment
   * [ax,az]→[bx,bz]. Returns the number of cells destroyed (0 when no hit).
   */
  erodeSegment(ax, az, bx, bz, radius = CRATER_R) {
    let destroyed = 0;
    const abx = bx - ax;
    const abz = bz - az;
    const len2 = abx * abx + abz * abz;

    for (let i = 0; i < this._liveCount; i++) {
      const flat = this._cellIndex[i];
      if (flat < 0) continue;
      const b = Math.floor(flat / (COLS * ROWS));
      const r = Math.floor((flat % (COLS * ROWS)) / COLS);
      const c = flat % COLS;
      if (!this.grids[b][r][c]) continue;

      const x = BUNKERS.X_POSITIONS[b] + (c - HALF_COLS) * CELL;
      // Swept segment–circle test in XZ.
      let t = len2 > 0 ? ((x - ax) * abx + (BUNKERS.Z - az) * abz) / len2 : 0;
      t = clamp(t, 0, 1);
      const cx = ax + abx * t - x;
      const cz = BUNKERS.Z - (az + abz * t);
      if (cx * cx + cz * cz <= radius * radius) {
        this.grids[b][r][c] = false;
        this._m4.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._m4);
        destroyed++;
      }
    }

    if (destroyed > 0) {
      this.liveCells -= destroyed;
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    return destroyed;
  }

  /** Rebuild all bunkers to full health (wave transition). */
  rebuild() {
    let i = 0; // instance cursor — mirrors construction order exactly
    for (let b = 0; b < BUNKERS.COUNT; b++) {
      const bx = BUNKERS.X_POSITIONS[b];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (isArchCell(c, r)) continue;
          const x = bx + (c - HALF_COLS) * CELL;
          const y = BUNKERS.BASE_Y + r * CELL * 0.8;
          this._m4.makeTranslation(x, y, BUNKERS.Z);
          this.mesh.setMatrixAt(i, this._m4);
          this.grids[b][r][c] = true; // restore live state — critical for next wave's erosion
          i++;
        }
      }
    }
    this.liveCells = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** True when any live cell exists (O(1)). */
  get hasLiveCells() { return this.liveCells > 0; }

  dispose() {
    this.scene.remove(this.mesh);
    this._geo.dispose(); // material is shared — owner disposes it
  }
}
