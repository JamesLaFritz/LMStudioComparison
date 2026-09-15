import * as THREE from 'three';
import { BOUNDS, BUNKERS, COLORS } from '../config.js';

/**
 * BunkerManager — four defensive shields, each a grid of small cells.
 *
 * All four bunkers share ONE geometry, ONE material, and ONE InstancedMesh
 * (one draw call for every bunker cell on screen). Erosion flips cells dead
 * and rewrites the instance matrices in place — no geometry churn, no leaks.
 *
 * Public surface:
 *   - bunkers: Bunker[]            (per-bunker cell logic + aabb)
 *   - aabb(i)                      world bounds of bunker i
 *   - cellAt(i, x, y)              true if a live cell covers the point
 *   - erode(i, x, y, r, falloff)   destroy cells within radius r
 *   - eatInvader(i, invAabb)       destroy cells overlapping an invader
 *   - anyAlive()                   true if any bunker still has cells
 *   - reset()                      rebuild all four bunkers
 *   - dispose()
 */

class Bunker {
  constructor(centerX) {
    this.centerX = centerX;
    this.centerY = BOUNDS.bunkerY;
    this.W = BUNKERS.gridW;
    this.H = BUNKERS.gridH;
    this.cell = BUNKERS.cell;
    this.width = this.W * this.cell;
    this.height = this.H * this.cell;

    // Classic trapezoid: flat top, sloped sides, notched bottom.
    this.mask = new Uint8Array(this.W * this.H);
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const nx = x / (this.W - 1);
        const ny = y / (this.H - 1);
        const leftEdge = 0.16 * (1 - ny);
        const rightEdge = 1 - 0.16 * (1 - ny);
        let on = nx >= leftEdge && nx <= rightEdge;
        if (ny > 0.72 && (nx < 0.32 || nx > 0.68)) on = false;
        this.mask[y * this.W + x] = on ? 1 : 0;
      }
    }
    this.alive = new Uint8Array(this.W * this.H);
    this.alive.set(this.mask);
    this.aliveCount = this.alive.reduce((a, b) => a + b, 0);
  }

  cellCenter(cx, cy) {
    const x = this.centerX - this.width / 2 + (cx + 0.5) * this.cell;
    const y = this.centerY - this.height / 2 + (cy + 0.5) * this.cell;
    return { x, y };
  }

  aabb() {
    return {
      minX: this.centerX - this.width / 2,
      maxX: this.centerX + this.width / 2,
      minY: this.centerY - this.height / 2,
      maxY: this.centerY + this.height / 2,
    };
  }

  cellAt(x, y) {
    const cx = Math.floor((x - (this.centerX - this.width / 2)) / this.cell);
    const cy = Math.floor((y - (this.centerY - this.height / 2)) / this.cell);
    if (cx < 0 || cx >= this.W || cy < 0 || cy >= this.H) return false;
    return this.alive[cy * this.W + cx] === 1;
  }

  erode(x, y, r, falloff = 0.25) {
    let destroyed = 0;
    let changed = false;
    const r2 = r * r;
    for (let cy = 0; cy < this.H; cy++) {
      for (let cx = 0; cx < this.W; cx++) {
        const idx = cy * this.W + cx;
        if (!this.alive[idx]) continue;
        const p = this.cellCenter(cx, cy);
        const dx = p.x - x, dy = p.y - y;
        if (dx * dx + dy * dy > r2) continue;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r * 0.6 && Math.random() < falloff) continue;
        this.alive[idx] = 0;
        this.aliveCount--;
        destroyed++;
        changed = true;
      }
    }
    if (changed) this._dirty = true;
    return destroyed;
  }

  eatInvader(invAabb) {
    let destroyed = 0;
    let changed = false;
    for (let cy = 0; cy < this.H; cy++) {
      for (let cx = 0; cx < this.W; cx++) {
        const idx = cy * this.W + cx;
        if (!this.alive[idx]) continue;
        const p = this.cellCenter(cx, cy);
        if (
          p.x >= invAabb.minX && p.x <= invAabb.maxX &&
          p.y >= invAabb.minY && p.y <= invAabb.maxY
        ) {
          this.alive[idx] = 0;
          this.aliveCount--;
          destroyed++;
          changed = true;
        }
      }
    }
    if (changed) this._dirty = true;
    return destroyed;
  }

  reset() {
    this.alive.set(this.mask);
    this.aliveCount = this.alive.reduce((a, b) => a + b, 0);
    this._dirty = true;
  }

  get isDestroyed() {
    return this.aliveCount <= 0;
  }
}

export default class BunkerManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../shared/core/MemoryRegistry.js').MemoryRegistry} registry
   */
  constructor(scene, registry) {
    this.scene = scene;
    this.registry = registry;

    const spacing = BUNKERS.spacing;
    const total = spacing * (BUNKERS.count - 1);
    const startX = -total / 2;
    this.bunkers = [];
    for (let i = 0; i < BUNKERS.count; i++) {
      this.bunkers.push(new Bunker(startX + i * spacing));
    }

    // Shared geometry + material (one draw call for all bunker cells).
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // instanceColor multiplies this for per-cell brightness
      emissive: new THREE.Color(COLORS.bunker),
      emissiveIntensity: 1.1,
      metalness: 0.3,
      roughness: 0.55,
    });
    registry.track(geo);
    registry.track(mat);
    this._geo = geo;
    this._mat = mat;

    const maxCells = this.bunkers.reduce((a, b) => a + b.W * b.H, 0);
    this.mesh = new THREE.InstancedMesh(geo, mat, maxCells);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._writeAll();
  }

  _writeAll() {
    const d = this._dummy;
    let i = 0;
    for (const b of this.bunkers) {
      for (let cy = 0; cy < b.H; cy++) {
        for (let cx = 0; cx < b.W; cx++) {
          if (!b.alive[cy * b.W + cx]) continue;
          const p = b.cellCenter(cx, cy);
          d.position.set(p.x, p.y, 0);
          d.rotation.set(0, 0, 0);
          d.scale.set(b.cell * 0.92, b.cell * 0.92, 0.4);
          d.updateMatrix();
          this.mesh.setMatrixAt(i, d.matrix);
          // Slight per-cell brightness variation for a hand-built look.
          const v = 0.85 + ((cx * 7 + cy * 13) % 5) * 0.05;
          this._color.setRGB(v, v, v);
          this.mesh.setColorAt(i, this._color);
          i++;
        }
      }
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Flush any pending erosion to the instance buffer (call once per frame). */
  flush() {
    if (this.bunkers.some((b) => b._dirty)) {
      for (const b of this.bunkers) b._dirty = false;
      this._writeAll();
    }
  }

  aabb(i) { return this.bunkers[i].aabb(); }
  cellAt(i, x, y) { return this.bunkers[i].cellAt(x, y); }
  erode(i, x, y, r, falloff) { return this.bunkers[i].erode(x, y, r, falloff); }
  eatInvader(i, invAabb) { return this.bunkers[i].eatInvader(invAabb); }

  anyAlive() { return this.bunkers.some((b) => !b.isDestroyed); }

  reset() {
    for (const b of this.bunkers) b.reset();
    this._writeAll();
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    // geo / mat disposed via registry
  }
}
