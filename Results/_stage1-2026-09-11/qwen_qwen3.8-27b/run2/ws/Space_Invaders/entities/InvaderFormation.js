// Space_Invaders/entities/InvaderFormation.js
// The 10×5 grid of invaders, rendered as three InstancedMeshes (one per
// species) — one draw call per species for the whole field.
//
// Classic step motion: the whole formation jumps `stepDX` units every
// `interval` seconds; `interval` is a pure function of survivors (frantic
// at 50, slow at 1). On a wall bounce the formation descends `stepDY`.
// Two-frame animation swaps each species' geometry (frame 0/1) per step.
//
// Collision data (world positions, radii) is exposed for the game layer.

import * as THREE from 'three';
import { makeInvaderGeometry, makeInvaderSheet } from '../../shared/utils/Procedural.js';
import { clamp } from '../../shared/utils/Math.js';

export class InvaderFormation {
  /**
   * @param {import('../../shared/core/Engine.js').Engine} engine
   * @param {object} cfg the CONFIG object from config.js
   */
  constructor(engine, cfg) {
    this.engine = engine;
    this.cfg = cfg;
    const F = cfg.invader;

    this.cols = F.cols;
    this.rows = F.rows;
    this.total = this.cols * this.rows;
    this.radius = F.radius;

    // Per-cell layout (world units, relative to the formation offset).
    this.cellW = F.spacingX;
    this.cellH = F.spacingY;
    this.originX = F.startX;
    this.originY = F.startY;

    // Invader records.
    this.invaders = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.invaders.push({
          col: c,
          row: r,
          species: F.speciesByRow[r],
          baseX: this.originX + c * this.cellW,
          baseY: this.originY - r * this.cellH,
          alive: true,
        });
      }
    }

    // Geometries: 3 species × 2 frames (pixel-art sheet cells).
    const w = 0.85;
    const h = 0.7;
    this.geos = [];
    for (let s = 0; s < 3; s++) {
      this.geos.push([
        makeInvaderGeometry(w, h, s, 0),
        makeInvaderGeometry(w, h, s, 1),
      ]);
    }

    // One InstancedMesh + material per species.
    this.meshes = [];
    this.materials = [];
    // Shared pixel-art sheet (3 species × 2 frames). UVs per geometry select
    // the cell; the sheet is the color + emissive map so the sprite reads.
    this._sheet = makeInvaderSheet();
    for (let s = 0; s < 3; s++) {
      const count = this.invaders.filter((v) => v.species === s).length;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0a0a14,
        emissive: new THREE.Color(F.colorBySpecies[s]),
        emissiveIntensity: 1.7,
        roughness: 0.5,
        metalness: 0.1,
        side: THREE.DoubleSide,
        map: this._sheet,
        emissiveMap: this._sheet,
        alphaTest: 0.5, // cut out the transparent sheet background
      });
      const mesh = new THREE.InstancedMesh(this.geos[s][0], mat, count);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      engine.scene.add(mesh);
      this.meshes.push(mesh);
      this.materials.push(mat);
    }

    // Formation state.
    this.fx = 0;
    this.fy = 0;
    this.dir = 1;
    this.frame = 0;
    this.stepTimer = 0;
    this.aliveCount = this.total;
    this.pulse = 0; // emissive pulse, decays each frame
    this._time = 0; // accumulated, drives the row-phase bob

    // Wave-scaled motion params (set by reset()).
    this.baseInterval = F.maxInterval;
    this.baseIntervalMin = F.minInterval;
    this.step = F.stepDX;
    this.descent = F.stepDY;

    // Scratch (no per-frame allocation).
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();

    this.reset(1);
  }

  /** (Re)initialize for a wave. */
  reset(wave) {
    const F = this.cfg.invader;
    this.fx = 0;
    this.fy = 0;
    this.dir = 1;
    this.frame = 0;
    this.stepTimer = 0;
    this.aliveCount = this.total;
    for (const v of this.invaders) v.alive = true;
    // Each wave is faster and descends a touch more.
    const k = Math.max(0.45, 1 - 0.08 * (wave - 1));
    this.baseInterval = F.maxInterval * k;
    this.baseIntervalMin = F.minInterval * k;
    this.descent = F.stepDY * (1 + 0.06 * (wave - 1));
    this.step = F.stepDX;
    this._applyFrameGeometry();
    this._writeMatrices(0);
  }

  /** interval(n) — pure function of survivors (classic acceleration). */
  intervalFor(n) {
    const t = (n - 1) / (this.total - 1); // 1 = full, 0 = one left
    return this.baseIntervalMin + (this.baseInterval - this.baseIntervalMin) * t;
  }

  /** Advance formation. Returns number of steps taken this frame. */
  update(dt) {
    if (this.aliveCount === 0) return 0;
    this._time += dt;
    this.stepTimer += dt;
    let steps = 0;
    let guard = 0;
    while (this.stepTimer >= this.intervalFor(this.aliveCount) && guard++ < 8) {
      this.stepTimer -= this.intervalFor(this.aliveCount);
      this._step();
      steps++;
    }
    // Emissive pulse decay.
    this.pulse = Math.max(0, this.pulse - dt * 6);
    this._writeMatrices(this._time);
    for (const mat of this.materials) {
      mat.emissiveIntensity = 1.7 + this.pulse;
    }
    return steps;
  }

  _step() {
    const minX = this._liveMinX();
    const maxX = this._liveMaxX();
    const bound = this.cfg.invader.wallLimit;
    let bounced = false;
    if (this.dir > 0 && maxX + this.step > bound) {
      this.dir = -1;
      bounced = true;
    } else if (this.dir < 0 && minX - this.step < -bound) {
      this.dir = 1;
      bounced = true;
    }
    if (bounced) {
      this.fy -= this.descent;
    } else {
      this.fx += this.dir * this.step;
    }
    this.frame ^= 1;
    this.pulse = 1.0;
    this._applyFrameGeometry();
  }

  _applyFrameGeometry() {
    for (let s = 0; s < 3; s++) {
      this.meshes[s].geometry = this.geos[s][this.frame];
    }
  }

  _liveMinX() {
    let m = Infinity;
    for (const v of this.invaders) {
      if (v.alive) m = Math.min(m, v.baseX + this.fx);
    }
    return m;
  }

  _liveMaxX() {
    let m = -Infinity;
    for (const v of this.invaders) {
      if (v.alive) m = Math.max(m, v.baseX + this.fx);
    }
    return m;
  }

  _writeMatrices(time) {
    // Per-species instance index counter (order must match killAt()).
    const idx = [0, 0, 0];
    const m = this._m, q = this._q, s = this._s, p = this._p;
    for (const v of this.invaders) {
      if (!v.alive) continue;
      const i = idx[v.species]++;
      // Row-phase bob: subtle vertical shimmer, phase-offset by row/col.
      const bob = Math.sin(time * 2.2 + v.row * 0.9 + v.col * 0.35) * 0.045;
      p.set(v.baseX + this.fx, v.baseY + this.fy + bob, 0);
      const sc = 1 + this.pulse * 0.06;
      s.set(sc, sc, 1);
      m.compose(p, q, s);
      this.meshes[v.species].setMatrixAt(i, m);
    }
    for (let sp = 0; sp < 3; sp++) {
      this.meshes[sp].instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Kill the invader at (col, row). Returns a world-space record
   * { species, x, y, z } or null if that cell is already dead.
   */
  killAt(col, row) {
    const v = this.invaders.find((x) => x.alive && x.col === col && x.row === row);
    if (!v) return null;
    v.alive = false;
    this.aliveCount--;
    // Hide the instance: scale 0 at its slot.
    const i = this._instanceIndex(v);
    const m = this._m;
    m.makeScale(0, 0, 0);
    m.setPosition(v.baseX + this.fx, v.baseY + this.fy, 0);
    this.meshes[v.species].setMatrixAt(i, m);
    this.meshes[v.species].instanceMatrix.needsUpdate = true;
    return {
      species: v.species,
      x: v.baseX + this.fx,
      y: v.baseY + this.fy,
      z: 0,
    };
  }

  /** Instance slot of a live invader (same order as _writeMatrices). */
  _instanceIndex(v) {
    let i = 0;
    for (const u of this.invaders) {
      if (!u.alive) continue;
      if (u === v) return i;
      if (u.species === v.species) i++;
    }
    return i;
  }

  /** Lowest live invader in a column (classic shooter rule). */
  bottomShooter(col) {
    let best = null;
    for (const v of this.invaders) {
      if (!v.alive || v.col !== col) continue;
      if (!best || v.row > best.row) best = v;
    }
    return best;
  }

  /** World position of an invader record. */
  worldPos(v) {
    return { x: v.baseX + this.fx, y: v.baseY + this.fy, z: 0 };
  }

  /** Call fn(inv) for every live invader (inv has world x/y + species). */
  forEachAlive(fn) {
    for (const v of this.invaders) {
      if (!v.alive) continue;
      fn({
        col: v.col,
        row: v.row,
        species: v.species,
        x: v.baseX + this.fx,
        y: v.baseY + this.fy,
        z: 0,
      });
    }
  }

  /**
   * First live invader whose circle touches the player circle.
   * Returns { x, y, z, species } or null.
   */
  firstContact(px, py, sumRadius) {
    const r2 = sumRadius * sumRadius;
    for (const v of this.invaders) {
      if (!v.alive) continue;
      const dx = v.baseX + this.fx - px;
      const dy = v.baseY + this.fy - py;
      if (dx * dx + dy * dy < r2) {
        return { x: v.baseX + this.fx, y: v.baseY + this.fy, z: 0, species: v.species };
      }
    }
    return null;
  }

  /** True if any live invader has reached the invasion line. */
  hasInvaded(playerY) {
    const margin = 1.2;
    for (const v of this.invaders) {
      if (v.alive && v.baseY + this.fy <= playerY + margin) return true;
    }
    return false;
  }

  dispose() {
    for (const mesh of this.meshes) this.engine.scene.remove(mesh);
    for (const pair of this.geos) for (const g of pair) g.dispose();
    for (const mat of this.materials) mat.dispose();
  }
}
