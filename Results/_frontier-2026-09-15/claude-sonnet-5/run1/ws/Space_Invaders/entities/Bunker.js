import * as THREE from 'three';
import { BunkerGeometryFactory } from '../procgen/BunkerGeometryFactory.js';
import { BUNKER } from '../config/GameConfig.js';

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _neutralColor = new THREE.Color(1, 1, 1);
const _hotColor = new THREE.Color(3.2, 2.2, 1.0);
const _tmpColor = new THREE.Color();

const FLASH_DURATION = 0.3;

/**
 * A destructible bunker: a vertical wall of blocks standing at fixed Z,
 * facing the player, matching the invaders' own camera-facing bitmap
 * convention. Destruction swaps a dead slot with the last live slot
 * (live-index compaction) so InstancedMesh.count always equals live cells —
 * no ghost blocks, no per-frame scan of dead cells.
 */
export class Bunker {
  constructor(scene, x, z, disposer) {
    this._scene = scene;
    this.x = x;
    this.z = z;

    const cellSize = BUNKER.cellSize;
    const baseHeight = (BunkerGeometryFactory.rows * cellSize) / 2;
    const baseCells = BunkerGeometryFactory.buildAliveCellList(cellSize);

    this._geometry = BunkerGeometryFactory.createCellGeometry(cellSize);
    disposer?.trackGeometry(this._geometry);

    this._material = new THREE.MeshStandardMaterial({
      color: 0x2a6b3f,
      emissive: 0x142d1a,
      emissiveIntensity: 0.4,
      roughness: 0.85,
      metalness: 0.05
    });
    disposer?.trackMaterial(this._material);

    const capacity = baseCells.length;
    this._mesh = new THREE.InstancedMesh(this._geometry, this._material, capacity);
    this._mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._mesh.frustumCulled = false;
    scene.add(this._mesh);

    this._liveSlots = baseCells.map((cell) => ({
      row: cell.row,
      col: cell.col,
      localX: cell.x,
      localY: cell.y + baseHeight,
      flashTimer: 0
    }));
    this._mesh.count = this._liveSlots.length;

    for (let i = 0; i < this._liveSlots.length; i++) {
      this._writeSlotMatrix(i);
      this._mesh.setColorAt(i, _neutralColor);
    }
    this._mesh.instanceMatrix.needsUpdate = true;
    if (this._mesh.instanceColor) this._mesh.instanceColor.needsUpdate = true;

    this._hasActiveFlash = false;
  }

  _writeSlotMatrix(index) {
    const slot = this._liveSlots[index];
    _position.set(this.x + slot.localX, slot.localY, this.z);
    _matrix.compose(_position, _quat, _scale);
    this._mesh.setMatrixAt(index, _matrix);
  }

  get isDestroyed() {
    return this._liveSlots.length === 0;
  }

  /** Epicenter cell dies along with everything inside craterRadius; the next ring out flashes as fractured but survives. */
  damageAt(row, col) {
    const craterRadius = BUNKER.craterRadius;
    const toDestroy = [];
    const toFlash = [];

    for (let i = 0; i < this._liveSlots.length; i++) {
      const slot = this._liveSlots[i];
      const chebyshev = Math.max(Math.abs(slot.row - row), Math.abs(slot.col - col));
      if (chebyshev <= craterRadius) {
        toDestroy.push(i);
      } else if (chebyshev <= craterRadius + 1) {
        toFlash.push(i);
      }
    }

    toDestroy.sort((a, b) => b - a);
    for (const index of toDestroy) this._destroySlotAt(index);

    for (const index of toFlash) {
      if (index < this._liveSlots.length) this._liveSlots[index].flashTimer = FLASH_DURATION;
    }
    this._hasActiveFlash = true;
  }

  _destroySlotAt(index) {
    const lastIndex = this._liveSlots.length - 1;
    if (index !== lastIndex) {
      this._liveSlots[index] = this._liveSlots[lastIndex];
      this._writeSlotMatrix(index);
    }
    this._liveSlots.pop();
    this._mesh.count = this._liveSlots.length;
    this._mesh.instanceMatrix.needsUpdate = true;
  }

  /** World-space hit test against live cells; returns the (row,col) of the closest hit cell or null. */
  hitTest(worldX, worldZ, hitRadius) {
    const cellSize = BUNKER.cellSize;
    const threshold = (hitRadius + cellSize * 0.5) * (hitRadius + cellSize * 0.5);
    for (let i = 0; i < this._liveSlots.length; i++) {
      const slot = this._liveSlots[i];
      const dx = worldX - (this.x + slot.localX);
      const dz = worldZ - this.z;
      if (dx * dx + dz * dz <= threshold) {
        return { row: slot.row, col: slot.col };
      }
    }
    return null;
  }

  update(dt) {
    if (!this._hasActiveFlash) return;
    let anyActive = false;

    for (let i = 0; i < this._liveSlots.length; i++) {
      const slot = this._liveSlots[i];
      if (slot.flashTimer <= 0) continue;

      slot.flashTimer = Math.max(0, slot.flashTimer - dt);
      const t = slot.flashTimer / FLASH_DURATION;
      _tmpColor.copy(_neutralColor).lerp(_hotColor, t);
      this._mesh.setColorAt(i, _tmpColor);
      if (slot.flashTimer > 0) anyActive = true;
    }

    if (this._mesh.instanceColor) this._mesh.instanceColor.needsUpdate = true;
    this._hasActiveFlash = anyActive;
  }

  dispose() {
    this._scene.remove(this._mesh);
  }
}
