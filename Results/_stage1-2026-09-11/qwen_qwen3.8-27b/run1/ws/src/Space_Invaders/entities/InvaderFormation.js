import * as THREE from 'three';
import { Entity } from '@shared/core/Entity.js';
import { ProceduralGeometry } from '@shared/core/ProceduralGeometry.js';
import { clamp } from '@shared/math/vec.js';
import { CONFIG } from '../config.js';

const { INVADERS, PLAYER, COLORS } = CONFIG;

/**
 * InvaderFormation — the 5×11 grid of invaders.
 *
 * Rendering: 5 types × 2 animation frames = 10 InstancedMeshes (55 instances
 * each). All invaders of a type share the global animation frame (authentic),
 * so a frame toggle only swaps which mesh is visible.
 *
 * Movement: discrete stepping (classic). `acc` accumulates
 * `dt · stepsPerSecond(remaining)`; each integer step moves the formation one
 * STEP in `dir`, flips the animation frame, and may drop the line on an edge.
 */
export class InvaderFormation extends Entity {
  constructor(scene, tracker) {
    super();
    this.scene = scene;
    this.tracker = tracker;

    this.rows = INVADERS.ROWS;
    this.cols = INVADERS.COLS;
    this.total = this.rows * this.cols;

    // Per-invader data.
    this.invaders = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.invaders.push({ row: r, col: c, alive: true });
      }
    }

    // Formation state.
    this.fx = 0;
    this.fz = 0;
    this.dir = 1;
    this.acc = 0;
    this.frame = 0;
    this.liveList = []; // indices of live invaders (per-type rebuild on kill)

    // Build the 10 instanced meshes.
    this.typeGeos = [];
    this.typeMats = [];
    this.meshes = []; // [type][frame]
    this.dummy = new THREE.Object3D();

    for (let t = 0; t < 5; t++) {
      const color = new THREE.Color(COLORS.invaders[t]);
      const geoA = this._buildTypeGeometry(t, 0);
      const geoB = this._buildTypeGeometry(t, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0a0f18,
        emissive: color,
        emissiveIntensity: 1.5,
        roughness: 0.4,
        metalness: 0.6,
      });
      const mA = new THREE.InstancedMesh(geoA, mat, this.total);
      const mB = new THREE.InstancedMesh(geoB, mat, this.total);
      mA.count = 0;
      mB.count = 0;
      mA.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mB.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mA.frustumCulled = false;
      mB.frustumCulled = false;
      scene.add(mA, mB);
      this.typeGeos.push([geoA, geoB]);
      this.typeMats.push(mat);
      this.meshes.push([mA, mB]);
      tracker.track(geoA);
      tracker.track(geoB);
      tracker.track(mat);
      tracker.track(mA);
      tracker.track(mB);
    }
  }

  /** Box-composition silhouette for a type + frame. */
  _buildTypeGeometry(type, frame) {
    const B = ProceduralGeometry.box;
    const M = ProceduralGeometry.merge;
    const legShift = frame === 0 ? 0 : 0.12;
    const legShiftX = frame === 0 ? 0 : -0.08;
    let parts;
    switch (type) {
      case 0: // squid
        parts = [
          B(0.8, 0.45, 0.45, 0, 0.05, 0),
          B(0.4, 0.35, 0.4, 0, 0.45, 0),
          B(0.14, 0.35, 0.3, -0.28, -0.25 + legShift, 0),
          B(0.14, 0.35, 0.3, 0.28, -0.25 + legShift, 0),
          B(0.14, 0.35, 0.3, -0.5, -0.15 + legShiftX, 0),
          B(0.14, 0.35, 0.3, 0.5, -0.15 - legShiftX, 0),
        ];
        break;
      case 1: // crab
        parts = [
          B(0.9, 0.4, 0.45, 0, 0, 0),
          B(0.2, 0.3, 0.3, -0.55, 0.15 + legShift, 0),
          B(0.2, 0.3, 0.3, 0.55, 0.15 + legShift, 0),
          B(0.12, 0.2, 0.2, -0.15, 0.3, 0),
          B(0.12, 0.2, 0.2, 0.15, 0.3, 0),
        ];
        break;
      case 2: // octopus
        parts = [
          B(0.75, 0.5, 0.45, 0, 0.1, 0),
          B(0.12, 0.4, 0.3, -0.2, -0.15 + legShift, 0),
          B(0.12, 0.4, 0.3, 0.2, -0.15 + legShift, 0),
          B(0.12, 0.4, 0.3, -0.4, -0.15 - legShift, 0),
          B(0.12, 0.4, 0.3, 0.4, -0.15 - legShift, 0),
          B(0.12, 0.4, 0.3, -0.6, -0.15 + legShift, 0),
          B(0.12, 0.4, 0.3, 0.6, -0.15 + legShift, 0),
        ];
        break;
      case 3: // small
        parts = [
          B(0.6, 0.55, 0.4, 0, 0, 0),
          B(0.25, 0.2, 0.3, -0.45, 0.2 + legShift, 0),
          B(0.25, 0.2, 0.3, 0.45, 0.2 + legShift, 0),
        ];
        break;
      default: // big
        parts = [
          B(0.95, 0.5, 0.5, 0, 0, 0),
          B(0.5, 0.35, 0.45, 0, 0.4, 0),
          B(0.16, 0.35, 0.35, -0.3, -0.3 + legShift, 0),
          B(0.16, 0.35, 0.35, 0.3, -0.3 + legShift, 0),
          B(0.16, 0.35, 0.35, -0.55, -0.2 - legShift, 0),
          B(0.16, 0.35, 0.35, 0.55, -0.2 - legShift, 0),
        ];
        break;
    }
    return M(parts);
  }

  /** World XZ of an invader index. */
  invaderXZ(i) {
    const inv = this.invaders[i];
    return {
      x: this.fx + (inv.col - (this.cols - 1) / 2) * INVADERS.DX,
      z: this.fz - (2 - inv.row) * INVADERS.DZ,
    };
  }

  invaderType(i) {
    return this.invaders[i].row;
  }

  get liveCount() {
    return this.liveList.length;
  }

  /** Reset for a wave. */
  reset(wave) {
    this.fx = 0;
    this.fz = (wave - 1) * INVADERS.WAVE_DROP;
    this.dir = 1;
    this.acc = 0;
    this.frame = 0;
    for (const inv of this.invaders) inv.alive = true;
    this.liveList = this.invaders.map((_, i) => i);
    this._writeAllMatrices();
  }

  /**
   * Advance the formation.
   * @param {number} dt
   * @param {number} stepsPerSecond
   * @returns {number} number of steps taken this frame (for the march audio)
   */
  update(dt, stepsPerSecond) {
    if (this.liveCount === 0) return 0;
    this.acc += dt * stepsPerSecond;
    let steps = 0;
    while (this.acc >= 1 && this.liveCount > 0) {
      this.acc -= 1;
      this._step();
      steps++;
    }
    return steps;
  }

  _step() {
    // Edge check against live min/max columns.
    let minCol = this.cols;
    let maxCol = -1;
    for (const i of this.liveList) {
      const c = this.invaders[i].col;
      if (c < minCol) minCol = c;
      if (c > maxCol) maxCol = c;
    }
    const half = (this.cols - 1) / 2;
    const edgeX = PLAYER.BOUNDS_X;
    if (this.dir > 0 && this.fx + (maxCol - half) * INVADERS.DX > edgeX) {
      this.dir = -1;
      this.fz += INVADERS.DROP;
    } else if (this.dir < 0 && this.fx + (minCol - half) * INVADERS.DX < -edgeX) {
      this.dir = 1;
      this.fz += INVADERS.DROP;
    } else {
      this.fx += this.dir * INVADERS.STEP;
    }
    this.frame = 1 - this.frame;
    this._writeAllMatrices();
  }

  /** Kill invader `i`. Returns { type, x, z } or null if already dead. */
  kill(i) {
    const inv = this.invaders[i];
    if (!inv || !inv.alive) return null;
    inv.alive = false;
    const pos = this.invaderXZ(i);
    const type = inv.row;
    // Swap-remove from liveList.
    const last = this.liveList[this.liveList.length - 1];
    this.liveList[this.liveList.indexOf(i)] = last;
    this.liveList.pop();
    this._writeTypeMatrices(type);
    return { type, x: pos.x, z: pos.z };
  }

  /** Weighted bomb target (bottom rows favored). */
  bombTarget() {
    if (this.liveList.length === 0) return null;
    const weights = [1, 1, 2, 3, 5];
    let total = 0;
    const byType = [[], [], [], [], []];
    for (const i of this.liveList) {
      const t = this.invaders[i].row;
      byType[t].push(i);
      total += weights[t];
    }
    let roll = Math.random() * total;
    for (let t = 0; t < 5; t++) {
      roll -= weights[t];
      if (roll <= 0 && byType[t].length > 0) {
        const i = byType[t][(Math.random() * byType[t].length) | 0];
        const p = this.invaderXZ(i);
        return { x: p.x, z: p.z };
      }
    }
    const i = this.liveList[(Math.random() * this.liveList.length) | 0];
    const p = this.invaderXZ(i);
    return { x: p.x, z: p.z };
  }

  /** True if any live invader has z >= threshold (invasion). */
  anyBelow(z) {
    for (const i of this.liveList) {
      if (this.invaderXZ(i).z >= z) return true;
    }
    return false;
  }

  _writeTypeMatrices(type) {
    const mesh = this.meshes[type][this.frame];
    const other = this.meshes[type][1 - this.frame];
    let n = 0;
    for (const i of this.liveList) {
      if (this.invaders[i].row !== type) continue;
      const p = this.invaderXZ(i);
      this.dummy.position.set(p.x, 0.45, p.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(n++, this.dummy.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    other.count = 0;
  }

  _writeAllMatrices() {
    for (let t = 0; t < 5; t++) this._writeTypeMatrices(t);
  }

  dispose() {
    // InstancedMesh has no dispose(); release its geometry + material instead.
    for (let t = 0; t < 5; t++) {
      this.typeGeos[t][0].dispose();
      this.typeGeos[t][1].dispose();
      this.typeMats[t].dispose();
    }
  }
}
