import * as THREE from 'three';
import { shieldCellGeometry } from '../../shared/procedural/GeometryFactory.js';

/**
 * Destructible bunker: a grid of health cells rendered as one InstancedMesh.
 * A hit erodes every cell within blast radius (with falloff); dead cells stop
 * rendering and stop blocking — the classic "bunker gets chewed up" behavior,
 * fully procedural. Coordinates are arena-plane (x right, y up).
 */

const COLS = 9;
const ROWS = 6;
const CELL_W = 0.52;
const CELL_H = 0.42;

/** Classic silhouette: dome top + bottom-center gate notch. */
function maskCell(r, c) {
  if (r === 0 && (c < 1 || c >= COLS - 1)) return false;      // round the shoulders
  if (r === 1 && (c === 0 || c === COLS - 1)) return false;    // taper the top corners
  const mid = Math.floor(COLS / 2);
  if (r >= ROWS - 3 && Math.abs(c - mid) <= 1) return false;   // the gate
  return true;
}

export class ShieldBunker {
  constructor(x, y) {
    this.x = x;
    this.y = y;

    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!maskCell(r, c)) continue;
        cells.push({
          x: x + (c - (COLS - 1) / 2) * CELL_W,
          y: y + ((ROWS - 1) / 2 - r) * CELL_H, // row 0 = top of the bunker
          hp: 3,
          alive: true,
        });
      }
    }
    this.cells = cells;

    const geo = shieldCellGeometry();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0b3d3a, roughness: 0.5, metalness: 0.2,
      emissive: 0x18e6c8, emissiveIntensity: 1.1,
    });
    this.mat = mat;

    const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.mesh = mesh;
    this._dummy = new THREE.Object3D();
    this.rebuildInstances();
  }

  rebuildInstances() {
    let i = 0;
    const d = this._dummy;
    for (const cell of this.cells) {
      if (!cell.alive) continue;
      d.position.set(cell.x, cell.y, 0);
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.mesh.setMatrixAt(i++, d.matrix);
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** True while any cell still stands. */
  hasCells() {
    for (const c of this.cells) if (c.alive) return true;
    return false;
  }

  /** Top-most live cell y — used by the formation-breach erosion test. */
  topY() {
    let t = -Infinity;
    for (const c of this.cells) if (c.alive && c.y > t) t = c.y;
    return t === -Infinity ? this.y : t;
  }

  /**
   * Does a projectile at (px, py) with radius r touch any live cell?
   * Returns the hit point (nearest cell center) or null.
   */
  erosionRadiusAt(px, py, r = 0.25) {
    let best = null;
    let bestD2 = Infinity;
    const reach = r + Math.max(CELL_W, CELL_H) * 0.6;
    for (const c of this.cells) {
      if (!c.alive) continue;
      const dx = c.x - px, dy = c.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < reach * reach && d2 < bestD2) { bestD2 = d2; best = c; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  /** Erode cells within blast radius of (x, y). Returns number destroyed. */
  erode(x, y, radius = 1.05, damage = 1) {
    let destroyed = 0;
    for (const cell of this.cells) {
      if (!cell.alive) continue;
      const dx = cell.x - x, dy = cell.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > radius * radius) continue;
      const t = Math.sqrt(d2) / radius; // 0 center → 1 edge
      cell.hp -= damage * (1.5 - 1.0 * t);
      if (cell.hp <= 0) { cell.alive = false; destroyed++; }
    }
    if (destroyed > 0) this.rebuildInstances();
    return destroyed;
  }

  /** Restore the full bunker (new wave / new game). */
  reset() {
    for (const c of this.cells) { c.hp = 3; c.alive = true; }
    this.rebuildInstances();
  }

  dispose() {
    this.mesh.dispose(); // InstancedMesh.dispose releases the instance buffers
    this.mat.dispose();
    // geometry is shared via GeometryFactory — disposed by disposeAll()
  }
}
