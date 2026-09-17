import * as THREE from 'three';
import { lerp, smoothstep } from '../../shared/utils/MathUtils.js';
import { InvaderGeometryFactory } from '../procgen/InvaderGeometryFactory.js';
import { FORMATION, ENEMY, PLAYFIELD } from '../config/GameConfig.js';

function archetypeForRow(row) {
  if (row === 0) return 'titan';
  if (row <= 2) return 'warden';
  return 'sentinel';
}

function archetypeColor(archetype) {
  if (archetype === 'titan') return 0xffb02e;
  if (archetype === 'warden') return 0xff3fd6;
  return 0x4de8ff;
}

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _zeroScale = new THREE.Vector3(0, 0, 0);

/**
 * The enemy grid. Movement follows the classic "speeds up as they die" model:
 * a step timer whose interval shrinks (smoothstep-eased) as aliveRatio drops,
 * with edge detection recomputed only from the currently alive bounding
 * columns (cheap — bounds only change when something dies).
 */
export class EnemyFormation {
  constructor(scene, { disposer = null } = {}) {
    this._scene = scene;
    this._disposer = disposer;
    this._meshes = {};
    this._materials = {};

    const rowArchetypes = [];
    for (let r = 0; r < FORMATION.rows; r++) rowArchetypes.push(archetypeForRow(r));

    const archetypeRowCounts = {};
    for (const archetype of rowArchetypes) {
      archetypeRowCounts[archetype] = (archetypeRowCounts[archetype] || 0) + 1;
    }

    for (const archetype of InvaderGeometryFactory.archetypes) {
      const rowCount = archetypeRowCounts[archetype] || 0;
      if (rowCount === 0) continue;

      const geometry = InvaderGeometryFactory.build(archetype);
      disposer?.trackGeometry(geometry);

      const material = new THREE.MeshStandardMaterial({
        color: 0x10131f,
        emissive: archetypeColor(archetype),
        emissiveIntensity: 1.0,
        roughness: 0.4,
        metalness: 0.5
      });
      disposer?.trackMaterial(material);

      const capacity = rowCount * FORMATION.cols;
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = capacity;
      scene.add(mesh);

      this._meshes[archetype] = mesh;
      this._materials[archetype] = material;
    }

    this._cells = [];
    const archetypeCounters = {};
    for (let r = 0; r < FORMATION.rows; r++) {
      const archetype = rowArchetypes[r];
      archetypeCounters[archetype] = archetypeCounters[archetype] || 0;
      for (let c = 0; c < FORMATION.cols; c++) {
        const instanceIndex = archetypeCounters[archetype]++;
        this._cells.push({
          row: r,
          col: c,
          archetype,
          instanceIndex,
          alive: true,
          worldX: 0,
          worldY: 0.6,
          worldZ: 0
        });
      }
    }

    this.totalCount = this._cells.length;
    this.aliveCount = this.totalCount;
    this.originX = 0;
    this.originZ = PLAYFIELD.formationStartZ;
    this.direction = 1;
    this.stepTimer = 0;
    this.stepInterval = FORMATION.maxStepInterval;
    this.time = 0;
    this._minCol = 0;
    this._maxCol = FORMATION.cols - 1;

    this._forceMatrixRefresh();
  }

  reset(waveConfig) {
    for (const cell of this._cells) cell.alive = true;
    this.aliveCount = this.totalCount;
    this.originX = 0;
    this.originZ = waveConfig.formationStartZ;
    this.direction = 1;
    this.stepTimer = 0;
    this.stepInterval = FORMATION.maxStepInterval;
    this._minCol = 0;
    this._maxCol = FORMATION.cols - 1;
    this._forceMatrixRefresh();
  }

  _recomputeBounds() {
    let minCol = Infinity;
    let maxCol = -Infinity;
    for (const cell of this._cells) {
      if (!cell.alive) continue;
      if (cell.col < minCol) minCol = cell.col;
      if (cell.col > maxCol) maxCol = cell.col;
    }
    this._minCol = minCol;
    this._maxCol = maxCol;
  }

  killCell(cell) {
    if (!cell.alive) return;
    cell.alive = false;
    this.aliveCount -= 1;
    this._recomputeBounds();
    this._hideCell(cell);
  }

  /**
   * Immediately zero-scales this cell's instance. Necessary because update()
   * (and its matrix pass) early-returns once aliveCount hits 0, so the very
   * last kill(s) of a wave would otherwise never get their matrix rewritten
   * and would stay rendered at full brightness forever.
   */
  _hideCell(cell) {
    const mesh = this._meshes[cell.archetype];
    _matrix.compose(_position.set(0, -50, 0), _quat, _zeroScale);
    mesh.setMatrixAt(cell.instanceIndex, _matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  pointsFor(archetype) {
    return ENEMY.points[archetype] ?? 10;
  }

  forEachAliveCell(callback) {
    for (const cell of this._cells) {
      if (cell.alive) callback(cell);
    }
  }

  /** Bottom-most (highest row index = closest to player) alive cell per column — the only ones allowed to fire. */
  getFireCandidates() {
    const bestByCol = new Map();
    for (const cell of this._cells) {
      if (!cell.alive) continue;
      const current = bestByCol.get(cell.col);
      if (!current || cell.row > current.row) bestByCol.set(cell.col, cell);
    }
    return Array.from(bestByCol.values());
  }

  setEmissiveIntensity(value) {
    for (const archetype in this._materials) {
      this._materials[archetype].emissiveIntensity = value;
    }
  }

  update(dt, waveConfig, onFormationReachedPlayer) {
    this.time += dt;
    if (this.aliveCount === 0) return;

    const aliveRatio = this.aliveCount / this.totalCount;
    const deadRatioEased = smoothstep(0, 1, 1 - aliveRatio);
    this.stepInterval = lerp(FORMATION.maxStepInterval, waveConfig.minStepIntervalFloor, deadRatioEased);

    this.stepTimer += dt;
    if (this.stepTimer >= this.stepInterval) {
      this.stepTimer -= this.stepInterval;
      this._step(onFormationReachedPlayer);
    }

    this._updateBobAndMatrices();
  }

  _step(onFormationReachedPlayer) {
    if (this._minCol === Infinity) return;

    const halfSpan = (FORMATION.cols - 1) / 2;
    const leftLocalX = (this._minCol - halfSpan) * FORMATION.spacingX;
    const rightLocalX = (this._maxCol - halfSpan) * FORMATION.spacingX;

    const attemptedOriginX = this.originX + this.direction * FORMATION.stepX;
    const attemptedLeft = attemptedOriginX + leftLocalX;
    const attemptedRight = attemptedOriginX + rightLocalX;

    if (attemptedLeft < PLAYFIELD.minX || attemptedRight > PLAYFIELD.maxX) {
      this.direction *= -1;
      this.originZ += FORMATION.stepDown;
    } else {
      this.originX = attemptedOriginX;
    }

    const frontZ = this.originZ + (FORMATION.rows - 1) * FORMATION.spacingZ;
    if (frontZ >= PLAYFIELD.loseZ) {
      onFormationReachedPlayer();
    }
  }

  _forceMatrixRefresh() {
    this._updateBobAndMatrices();
  }

  _updateBobAndMatrices() {
    const halfSpan = (FORMATION.cols - 1) / 2;

    for (const cell of this._cells) {
      const mesh = this._meshes[cell.archetype];
      if (!cell.alive) {
        _matrix.compose(_position.set(0, -50, 0), _quat, _zeroScale);
        mesh.setMatrixAt(cell.instanceIndex, _matrix);
        continue;
      }

      const localX = (cell.col - halfSpan) * FORMATION.spacingX;
      const worldX = this.originX + localX;
      const worldZ = this.originZ + cell.row * FORMATION.spacingZ;
      const bob = Math.sin(this.time * FORMATION.bobFrequency + cell.instanceIndex * 0.3) * FORMATION.bobAmplitude;
      const worldY = 0.6 + bob;

      cell.worldX = worldX;
      cell.worldY = worldY;
      cell.worldZ = worldZ;

      _position.set(worldX, worldY, worldZ);
      _matrix.compose(_position, _quat, _scale);
      mesh.setMatrixAt(cell.instanceIndex, _matrix);
    }

    for (const archetype in this._meshes) {
      this._meshes[archetype].instanceMatrix.needsUpdate = true;
    }
  }

  get frontZ() {
    return this.originZ + (FORMATION.rows - 1) * FORMATION.spacingZ;
  }

  dispose() {
    for (const archetype in this._meshes) {
      this._scene.remove(this._meshes[archetype]);
    }
  }
}
