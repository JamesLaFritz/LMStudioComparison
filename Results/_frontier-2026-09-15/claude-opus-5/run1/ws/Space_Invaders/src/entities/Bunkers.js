// Four destructible voxel bunkers in one InstancedMesh. Cells have 2 HP: the first hit scorches
// (per-instance colour darkens diffuse and emissive), the second removes the cell.
import { InstancedMesh, BoxGeometry, Matrix4, Vector3, Quaternion, Color, DynamicDrawUsage } from 'three';
import { neonMaterial, enableInstanceEmissiveTint } from '@shared/procgen/MaterialLibrary.js';
import { makeAabb, setAabb, segmentAabb, aabbOverlap } from '@shared/math/Collision.js';
import { parseBitmap } from '@shared/procgen/GeometryUtils.js';
import { BUNKER_BITMAP } from '../data/InvaderBitmaps.js';
import { WORLD, BUNKER, COLORS } from '../config.js';

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _box = makeAabb();

const FULL = new Color(1, 1, 1);
const SCORCH = new Color(0.55, 0.3, 0.12);

export class Bunkers {
  /**
   * @param {import('three').Scene} scene
   * @param {import('@shared/core/ResourceTracker.js').ResourceTracker} tracker
   * @param {import('@shared/procgen/Random.js').Random} random
   */
  constructor(scene, tracker, random) {
    this.scene = scene;
    this.random = random;
    this.count = WORLD.BUNKER_XS.length;
    this.cols = BUNKER.COLS;
    this.rows = BUNKER.ROWS;
    this.cellsPerBunker = this.cols * this.rows;
    this.total = this.count * this.cellsPerBunker;

    const bitmap = parseBitmap(BUNKER_BITMAP);
    this.shape = bitmap.cells;
    this.hp = new Uint8Array(this.total);
    this.liveCells = 0;

    const size = BUNKER.CELL * 0.92;
    this.geometry = tracker.track(new BoxGeometry(size, size, BUNKER.CELL * 1.2));
    this.material = tracker.track(
      neonMaterial({ color: 0x0c1a10, emissive: COLORS.BUNKER, intensity: 0.9, roughness: 0.5, metalness: 0.1 }),
    );
    enableInstanceEmissiveTint(this.material);

    this.mesh = new InstancedMesh(this.geometry, this.material, this.total);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'Bunkers';
    for (let i = 0; i < this.total; i++) this.mesh.setColorAt(i, FULL);
    this.mesh.instanceColor.setUsage(DynamicDrawUsage);
    scene.add(this.mesh);
    tracker.track(this.mesh);

    this.halfW = (this.cols * BUNKER.CELL) / 2;
    this.halfH = (this.rows * BUNKER.CELL) / 2;
    this.boxes = [];
    for (let b = 0; b < this.count; b++) {
      this.boxes.push(setAabb(makeAabb(), WORLD.BUNKER_XS[b], WORLD.BUNKER_Y, this.halfW, this.halfH));
    }

    this.rebuild();
  }

  cellIndex(b, i, j) {
    return b * this.cellsPerBunker + j * this.cols + i;
  }

  cellX(index) {
    const b = Math.floor(index / this.cellsPerBunker);
    const local = index - b * this.cellsPerBunker;
    const i = local % this.cols;
    return WORLD.BUNKER_XS[b] + (i - this.cols / 2 + 0.5) * BUNKER.CELL;
  }

  cellY(index) {
    const local = index % this.cellsPerBunker;
    const j = Math.floor(local / this.cols);
    return WORLD.BUNKER_Y + (this.rows / 2 - j - 0.5) * BUNKER.CELL;
  }

  /** Restore all four bunkers to full health. */
  rebuild() {
    this.liveCells = 0;
    _q.identity();
    for (let b = 0; b < this.count; b++) {
      for (let j = 0; j < this.rows; j++) {
        for (let i = 0; i < this.cols; i++) {
          const index = this.cellIndex(b, i, j);
          const solid = this.shape[j * this.cols + i];
          this.hp[index] = solid ? BUNKER.HP : 0;
          if (solid) this.liveCells++;
          this._writeCell(index);
        }
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  _writeCell(index) {
    const hp = this.hp[index];
    if (hp <= 0) {
      _s.set(0, 0, 0);
      _p.set(0, -100, 0);
    } else {
      _s.set(1, 1, 1);
      _p.set(this.cellX(index), this.cellY(index), 0);
    }
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(index, _m);
    this.mesh.setColorAt(index, hp >= BUNKER.HP ? FULL : SCORCH);
  }

  _setHp(index, hp) {
    const before = this.hp[index];
    if (before <= 0) return false;
    const after = Math.max(0, hp);
    this.hp[index] = after;
    if (after === 0) this.liveCells--;
    this._writeCell(index);
    return after === 0;
  }

  /**
   * Apply impact damage: the centre cell takes 2, each 4-neighbour takes 1 with probability p.
   * Returns { destroyed, x, y }.
   */
  damage(index, radius = 1) {
    const b = Math.floor(index / this.cellsPerBunker);
    const local = index - b * this.cellsPerBunker;
    const ci = local % this.cols;
    const cj = Math.floor(local / this.cols);
    let destroyed = 0;
    if (this._setHp(index, this.hp[index] - 2)) destroyed++;
    if (radius > 0) {
      const neighbours = [
        [ci - 1, cj],
        [ci + 1, cj],
        [ci, cj - 1],
        [ci, cj + 1],
      ];
      for (const [ni, nj] of neighbours) {
        if (ni < 0 || nj < 0 || ni >= this.cols || nj >= this.rows) continue;
        const n = this.cellIndex(b, ni, nj);
        if (this.hp[n] > 0 && this.random.chance(BUNKER.NEIGHBOR_CHANCE)) {
          if (this._setHp(n, this.hp[n] - 1)) destroyed++;
        }
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    return { destroyed, x: this.cellX(index), y: this.cellY(index) };
  }

  /**
   * First live cell hit by a bullet sweeping (x0,y0)→(x1,y1) with half-width `halfW`.
   * Returns the cell index or -1.
   */
  hitSegment(x0, y0, x1, y1, halfW = 0) {
    for (let b = 0; b < this.count; b++) {
      const box = this.boxes[b];
      _box.minX = box.minX - halfW;
      _box.maxX = box.maxX + halfW;
      _box.minY = box.minY;
      _box.maxY = box.maxY;
      const t = segmentAabb(x0, y0, x1, y1, _box);
      if (t < 0) continue;

      // March along the segment at half-cell resolution and probe the cell under each sample.
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      const samples = Math.max(1, Math.ceil(len / (BUNKER.CELL * 0.5)));
      for (let s = 0; s <= samples; s++) {
        const u = s / samples;
        if (u < t) continue;
        const px = x0 + dx * u;
        const py = y0 + dy * u;
        // Check the bullet's width by probing its centre and both edges.
        for (let k = -1; k <= 1; k++) {
          const qx = px + k * halfW;
          const i = Math.floor((qx - box.minX) / BUNKER.CELL);
          const j = Math.floor((box.maxY - py) / BUNKER.CELL);
          if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) continue;
          const index = this.cellIndex(b, i, j);
          if (this.hp[index] > 0) return index;
        }
      }
    }
    return -1;
  }

  /** Erase every live cell inside `box` (an invader overlapping a bunker). Returns cells erased. */
  eraseAabb(box) {
    let erased = 0;
    for (let b = 0; b < this.count; b++) {
      if (!aabbOverlap(box, this.boxes[b])) continue;
      const bb = this.boxes[b];
      const i0 = Math.max(0, Math.floor((box.minX - bb.minX) / BUNKER.CELL));
      const i1 = Math.min(this.cols - 1, Math.floor((box.maxX - bb.minX) / BUNKER.CELL));
      const j0 = Math.max(0, Math.floor((bb.maxY - box.maxY) / BUNKER.CELL));
      const j1 = Math.min(this.rows - 1, Math.floor((bb.maxY - box.minY) / BUNKER.CELL));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const index = this.cellIndex(b, i, j);
          if (this.hp[index] > 0) {
            this._setHp(index, 0);
            erased++;
          }
        }
      }
    }
    if (erased > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
    }
    return erased;
  }

  /** Top edge of the bunker band (for cheap broad-phase rejection). */
  get topY() {
    return WORLD.BUNKER_Y + this.halfH;
  }

  get bottomY() {
    return WORLD.BUNKER_Y - this.halfH;
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
  }
}
