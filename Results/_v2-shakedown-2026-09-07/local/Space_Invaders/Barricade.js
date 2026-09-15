import * as THREE from 'three';
import { clamp } from '../shared/utils/Math.js';

/**
 * Four destructible bunkers, one InstancedMesh (4 × 48 = 192 cells).
 * A destroyed cell is hidden by scaling its instance matrix to zero —
 * no geometry churn, no per-cell draw call.
 */
export class Barricade {
  constructor(scene, {
    centers = [-7.5, -2.5, 2.5, 7.5],
    topY = 3.4,
    cell = 0.55,
    cols = 8,
    rows = 6,
    hp = 3,
  } = {}) {
    this.scene = scene;
    this.cell = cell;
    this.cols = cols;
    this.rows = rows;
    this._hp = hp;

    // Classic notch: top and bottom rows lose their center two cells.
    const mask = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const notch = (r === 0 || r === rows - 1) && (c === 3 || c === 4);
        row.push(!notch);
      }
      mask.push(row);
    }
    this.mask = mask;

    // Per-cell state.
    this.cells = [];
    for (const cx of centers) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this.cells.push({
            x: cx + (c - (cols - 1) / 2) * cell,
            y: topY - (r + 0.5) * cell,
            hp: mask[r][c] ? hp : 0,
            alive: mask[r][c],
            _r: r,
            _c: c,
          });
        }
      }
    }

    const geo = new THREE.BoxGeometry(cell * 0.92, cell * 0.92, 0.5);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a2a33,
      metalness: 0.5,
      roughness: 0.4,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.5,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.cells.length);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.dummy = new THREE.Object3D();
    this._t = 0;
    this._writeMatrices();
  }

  get aliveCount() {
    let n = 0;
    for (const c of this.cells) if (c.alive) n++;
    return n;
  }

  /** Damage every live cell whose AABB overlaps the given point-AABB. Returns cells destroyed. */
  damageAt(x, y, hw, hh) {
    const destroyed = [];
    const h = this.cell * 0.5;
    for (const c of this.cells) {
      if (!c.alive) continue;
      if (Math.abs(x - c.x) < hw + h && Math.abs(y - c.y) < hh + h) {
        c.hp -= 1;
        if (c.hp <= 0) {
          c.alive = false;
          destroyed.push(c);
        }
      }
    }
    if (destroyed.length) this._writeMatrices();
    return destroyed;
  }

  /** Invaders "eat" bunkers: destroy every overlapping cell. Returns cells destroyed. */
  destroyAt(x, y, hw, hh) {
    const destroyed = [];
    const h = this.cell * 0.5;
    for (const c of this.cells) {
      if (!c.alive) continue;
      if (Math.abs(x - c.x) < hw + h && Math.abs(y - c.y) < hh + h) {
        c.alive = false;
        destroyed.push(c);
      }
    }
    if (destroyed.length) this._writeMatrices();
    return destroyed;
  }

  /**
   * First live cell overlapping the given box (bullet half-extents hw/hh).
   * Returns the cell (with hp already decremented) or null.
   */
  hitAt(x, y, hw, hh) {
    const h = this.cell * 0.5;
    for (const c of this.cells) {
      if (!c.alive) continue;
      if (Math.abs(x - c.x) < hw + h && Math.abs(y - c.y) < hh + h) {
        c.hp -= 1;
        if (c.hp <= 0) c.alive = false;
        this._writeMatrices();
        return c;
      }
    }
    return null;
  }

  /**
   * Invaders "eat" bunkers: destroy every live cell overlapping the box.
   * Calls `onCell(cell)` for each destroyed cell (VFX hook).
   */
  destroyOverlapping(x, y, hw, hh, onCell) {
    const h = this.cell * 0.5;
    let any = false;
    for (const c of this.cells) {
      if (!c.alive) continue;
      if (Math.abs(x - c.x) < hw + h && Math.abs(y - c.y) < hh + h) {
        c.alive = false;
        any = true;
        if (onCell) onCell(c);
      }
    }
    if (any) this._writeMatrices();
  }

  _writeMatrices() {
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      this.dummy.position.set(c.x, c.y, 0);
      const s = c.alive ? 1 : 0.0001;
      this.dummy.scale.set(s, s, s);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Restore every cell to full HP (new wave). */
  reset() {
    for (const c of this.cells) {
      c.alive = this.mask[c._r][c._c];
      c.hp = c.alive ? this._hp : 0;
    }
    this._writeMatrices();
  }

  update(dt) {
    this._t += dt;
    // Subtle breathing glow.
    this.mesh.material.emissiveIntensity = 0.45 + 0.15 * Math.sin(this._t * 2.2);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
