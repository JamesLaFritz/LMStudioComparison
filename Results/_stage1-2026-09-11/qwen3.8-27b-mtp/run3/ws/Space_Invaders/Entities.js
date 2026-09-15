// Space_Invaders/Entities.js
// All game actors. Every dynamic object is preallocated and pooled; hot paths
// (update loops) perform zero heap allocations — scratch objects are module-level.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../shared/procedural/Noise.js';

// ---------------------------------------------------------------------------
// Voxel geometry builder — pixel maps → merged unit-cube geometry.
// Maps are arrays of strings; '#' = filled cell, '.' = empty. Row 0 is the
// visual TOP (maps to +y). Geometry is centered on its own origin so it can be
// mirrored with a negative x-scale (the classic two-frame walk flip).
// ---------------------------------------------------------------------------

const CELL = 0.92;      // cube edge — small gap between cells reads as "voxel"
const DEPTH = 0.85;     // z-thickness of the voxel slab

function buildVoxelGeometry(map, targetWidth) {
  const rows = map.length;
  const cols = map[0].length;
  const boxes = [];
  for (let r = 0; r < rows; r++) {
    const rowStr = map[r];
    for (let c = 0; c < cols; c++) {
      if (rowStr.charCodeAt(c) !== 35 /* '#' */) continue;
      const box = new THREE.BoxGeometry(CELL, CELL, DEPTH);
      const x = c - (cols - 1) / 2;
      const y = (rows - 1) / 2 - r; // row 0 → top (+y)
      box.translate(x, y, 0);
      boxes.push(box);
    }
  }
  const merged = mergeGeometries(boxes, false);
  for (const b of boxes) b.dispose();

  // Uniformly scale so the silhouette spans `targetWidth` world units.
  // The map is centered on its origin, so scaling about the origin keeps it centered.
  if (targetWidth > 0) {
    merged.computeBoundingBox();
    const sizeX = merged.boundingBox.max.x - merged.boundingBox.min.x;
    if (sizeX > 1e-6) {
      const s = targetWidth / sizeX;
      const m = new THREE.Matrix4().makeScale(s, s, s);
      merged.applyMatrix4(m);
    }
  }
  return merged;
}

// Target silhouette widths (world units). Invaders sit in a 2.6 u column grid,
// so each body must stay under ~2.4 u wide to read as distinct ships.
const INVADER_W = 2.3;
const PLAYER_W = 3.4;
const UFO_W = 6.4;

// Classic silhouettes (11 wide). SQUID: narrow crown + leg fringe.
const MAP_SQUID = [
  '....###....',
  '..#######..',
  '.#########.',
  '##.#####.##',
  '#...#.#...#',
  '#.#.....#.#',
  '#.........#',
  '..#.....#..'
];

// CRAB: wide body + antennae.
const MAP_CRAB = [
  '.#.......#.',
  '..#.....#..',
  '..#######..',
  '###.###.###',
  '###########',
  '##.#####.##',
  '#...#.#...#',
  '#.##...##.#'
];

// OCTOPUS: round mass + tentacles.
const MAP_OCTO = [
  '..#######..',
  '.#########.',
  '###########',
  '###.###.###',
  '###########',
  '##.......##',
  '#.#.....#.#',
  '#.........#'
];

// Player ship (13 wide) — wedge with a tail notch.
const MAP_PLAYER = [
  '......#......',
  '.....###.....',
  '....#####....',
  '...#######...',
  '.###########.',
  '#############',
  '##..#####..##'
];

// Mystery UFO (15 wide) — saucer with dome.
const MAP_UFO = [
  '......###......',
  '....#######....',
  '..###########..',
  '.#############.',
  '###############'
];

// Row → type index: 0=SQUID, 1=CRAB, 2=OCTO (rows 0 / 1-2 / 3-4).
const ROW_TYPE = [0, 1, 1, 2, 2];
export const TYPE_POINTS = [30, 20, 10]; // per row type: squid 30, crab 20, octo 10
export const TYPE_COLORS = [0x7df9ff, 0xff5ce1, 0x86ff5c]; // squid cyan · crab magenta · octo green

const BODY_MAT_PARAMS = { metalness: 0.7, roughness: 0.35 };
const CORE_MAT_PARAMS = { metalness: 0.2, roughness: 0.4 };

function makeBodyMaterial(colorHex) {
  return new THREE.MeshStandardMaterial({ color: colorHex, ...BODY_MAT_PARAMS });
}
function makeCoreMaterial(colorHex) {
  return new THREE.MeshStandardMaterial({
    color: 0x0a0f18, emissive: colorHex, emissiveIntensity: 2.4, ...CORE_MAT_PARAMS
  });
}

// Module-level scratch (zero per-frame allocation).
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _cWhite = new THREE.Color(0xffffff);

function composeInstance(mesh, i, x, y, z, sx, sy) {
  _p.set(x, y, z);
  _q.identity();
  _s.set(sx, sy, 1);
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
}

// ===========================================================================
// PlayerShip
// ===========================================================================
export class PlayerShip {
  /**
   * @param {THREE.Scene} scene
   * @param {(r: THREE.BufferGeometry|THREE.Material)=>void} track — disposal registry hook
   */
  constructor(scene, track) {
    this.scene = scene;

    const bodyGeo = buildVoxelGeometry(MAP_PLAYER);
    const coreGeo = new THREE.BoxGeometry(1.5, 0.9, DEPTH + 0.25);
    const bodyMat = makeBodyMaterial(0xbfe6ff);
    const coreMat = makeCoreMaterial(0x37e8ff);
    track(bodyGeo); track(coreGeo); track(bodyMat); track(coreMat);

    this.group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.4;
    this.group.add(body, core);
    this.body = body;
    this.core = core;

    // Shield bubble (SHIELD power-up) — hidden until active.
    const shieldGeo = new THREE.SphereGeometry(2.15, 20, 14);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x37e8ff, emissive: 0x37e8ff, emissiveIntensity: 0.9,
      transparent: true, opacity: 0.16, metalness: 0.1, roughness: 0.2,
      depthWrite: false
    });
    track(shieldGeo); track(shieldMat);
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    scene.add(this.group);

    // State.
    this.x = 0;
    this.y = 2;                 // fixed lane
    this.vx = 0;
    this.alive = true;
    this.invulnT = 0;           // seconds of post-respawn invulnerability remaining
    this.fireCooldown = 0;      // seconds until next shot allowed
    this.baseFireInterval = 0.38;
    this.shieldActive = false;

    this.group.position.set(0, this.y, 0);
  }

  get fireInterval() { return this._fireInterval || this.baseFireInterval; }
  setFireInterval(v) { this._fireInterval = v; }

  /** @returns {boolean} true when a shot may be fired */
  readyToFire() { return this.alive && this.fireCooldown <= 0; }
  consumeFire() { this.fireCooldown = this.fireInterval; }

  setShield(on) {
    if (this.shieldActive === on) return;
    this.shieldActive = on;
    this.shieldMesh.visible = on;
  }

  /**
   * @param {number} dt scaled seconds
   * @param {number} moveX normalized input [-1, 1]
   */
  update(dt, moveX) {
    if (!this.alive) return;

    const MAX_SPEED = 26;
    const targetV = moveX * MAX_SPEED;
    // Exponential settle: instant feel, no floaty drift.
    const k = 1 - Math.exp(-dt * 14);
    this.vx += (targetV - this.vx) * k;
    this.x += this.vx * dt;
    if (this.x < -18.5) { this.x = -18.5; this.vx = Math.max(0, this.vx); }
    else if (this.x > 18.5) { this.x = 18.5; this.vx = Math.min(0, this.vx); }

    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.invulnT > 0) {
      this.invulnT -= dt;
      // Blink: toggle body visibility at ~12 Hz while invulnerable.
      const on = Math.sin(this.invulnT * 40) > -0.3;
      this.body.visible = on;
      this.core.visible = on;
    } else {
      this.body.visible = true;
      this.core.visible = true;
    }

    // Engine glow pulse (subtle life).
    const pulse = 2.1 + Math.sin(performance.now() * 0.006) * 0.35;
    this.core.material.emissiveIntensity = pulse;

    this.group.position.x = this.x;
    if (this.shieldActive) {
      // Slow shield spin for readability.
      this.shieldMesh.rotation.y += dt * 1.2;
      const s = 1 + Math.sin(performance.now() * 0.004) * 0.03;
      this.shieldMesh.scale.setScalar(s);
    }
  }

  reset(x = 0) {
    this.x = x; this.vx = 0;
    this.alive = true;
    this.invulnT = 2.0;
    this.fireCooldown = 0.4;   // brief grace after respawn
    this.setShield(false);
    this.body.visible = true;
    this.core.visible = true;
    this.group.position.x = x;
    this.group.visible = true;
  }

  die() {
    this.alive = false;
    this.group.visible = false;
    this.shieldMesh.visible = false;
    this.shieldActive = false;
  }
}

// ===========================================================================
// InvaderFormation — the heart of the game.
// One FormationState drives all 55 instances: origin, direction, step phase.
// Rendered as 3 body InstancedMeshes + 3 emissive-core InstancedMeshes (6 draw calls).
// ===========================================================================

const COLS = 11;
const ROWS = 5;
const N = COLS * ROWS;
const DX = 2.6;   // column spacing
const DY = 2.2;   // row spacing
const STEP_X = 1.05;
const DROP_Y = 2.0;
const BOUND = 19;

export class InvaderFormation {
  /**
   * @param {THREE.Scene} scene
   * @param {(r: THREE.BufferGeometry|THREE.Material)=>void} track
   */
  constructor(scene, track) {
    this.scene = scene;
    this.aliveArr = new Uint8Array(N); // 1 = alive

    const geos = [buildVoxelGeometry(MAP_SQUID), buildVoxelGeometry(MAP_CRAB), buildVoxelGeometry(MAP_OCTO)];
    const coreGeo = new THREE.BoxGeometry(0.9, 0.7, DEPTH + 0.3);
    track(coreGeo);

    // Per-type instance counts (row membership is fixed for the level).
    this.typeCounts = [11, 22, 22];
    this.bodies = [];
    this.cores = [];
    for (let t = 0; t < 3; t++) {
      const bodyMat = makeBodyMaterial(TYPE_COLORS[t]);
      const coreMat = makeCoreMaterial(TYPE_COLORS[t]);
      track(geos[t]); track(bodyMat); track(coreMat);

      const body = new THREE.InstancedMesh(geos[t], bodyMat, this.typeCounts[t]);
      const core = new THREE.InstancedMesh(coreGeo, coreMat, this.typeCounts[t]);
      body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      core.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Per-instance tint: white base (setColorAt creates the instanceColor buffer).
      for (let i = 0; i < this.typeCounts[t]; i++) {
        body.setColorAt(i, _cWhite);
        core.setColorAt(i, _cWhite);
      }
      scene.add(body, core);
      this.bodies.push(body);
      this.cores.push(core);
    }

    // Instance index bookkeeping: invader i → (type t, local slot s).
    this.invType = new Uint8Array(N);
    this.invSlot = new Uint16Array(N);
    let slot = [0, 0, 0];
    for (let r = 0; r < ROWS; r++) {
      const t = ROW_TYPE[r];
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        this.invType[i] = t;
        this.invSlot[i] = slot[t]++;
        this.aliveArr[i] = 1;
      }
    }

    // Formation state.
    this.originX = 0;
    this.originY = 24;   // set by Game per level
    this.dir = 1;
    this.stepTimer = 0;
    this.flipParity = 0;
    this.aliveCount = N;

    this._writeAll();
  }

  /** Tempo law: T(n) seconds/step — accelerates as the fleet dies. */
  stepPeriod(levelSpeedMul) {
    const f = (N - this.aliveCount) / (N - 1); // 0 full → 1 one survivor
    const base = 0.55 + (0.13 - 0.55) * f;     // lerp(0.55, 0.13, f)
    return Math.max(0.13, base / levelSpeedMul);
  }

  /** Live-formation bounds in world space (event-driven recompute). */
  liveBounds(out) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!this.aliveArr[r * COLS + c]) continue;
        const x = this.originX + (c - (COLS - 1) / 2) * DX;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        const y = this.originY - r * DY;
        if (y < minY) minY = y;
      }
    }
    out.minX = minX === Infinity ? 0 : minX;
    out.maxX = maxX === -Infinity ? 0 : maxX;
    out.minY = minY === Infinity ? 999 : minY;
    return out;
  }

  /** World position of invader i (out.x, out.y). */
  worldPos(i, out) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    out.x = this.originX + (c - (COLS - 1) / 2) * DX;
    out.y = this.originY - r * DY;
    return out;
  }

  kill(i) {
    if (!this.aliveArr[i]) return false;
    this.aliveArr[i] = 0;
    this.aliveCount--;
    // Zero-scale the dead instance (both body and core).
    const t = this.invType[i];
    const s = this.invSlot[i];
    composeInstance(this.bodies[t], s, 0, -999, 0, 0.0001, 0.0001);
    composeInstance(this.cores[t], s, 0, -999, 0, 0.0001, 0.0001);
    this.bodies[t].instanceMatrix.needsUpdate = true;
    this.cores[t].instanceMatrix.needsUpdate = true;
    return true;
  }

  /** One discrete march step (boundary-aware). Returns 'step' | 'drop'. */
  doStep() {
    const b = this.liveBounds(this._bounds || (this._bounds = { minX: 0, maxX: 0, minY: 0 }));
    const halfSpan = Math.max(b.maxX - this.originX, this.originX - b.minX);
    const nextX = this.originX + this.dir * STEP_X;
    if (nextX + halfSpan > BOUND || nextX - halfSpan < -BOUND) {
      // Reverse and drop.
      this.dir *= -1;
      this.originY -= DROP_Y;
    } else {
      this.originX = nextX;
    }
    this.flipParity ^= 1;
    this._writeAll();
    return true;
  }

  _writeAll() {
    const squash = this.flipParity === 0 ? 1.0 : 0.92; // step feel
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (!this.aliveArr[i]) continue;
        const x = this.originX + (c - (COLS - 1) / 2) * DX;
        const y = this.originY - r * DY;
        const t = this.invType[i];
        const s = this.invSlot[i];
        composeInstance(this.bodies[t], s, x, y, 0, 1, squash);
        composeInstance(this.cores[t], s, x, y + 0.15, 0, 1, squash);
      }
    }
    for (let t = 0; t < 3; t++) {
      this.bodies[t].instanceMatrix.needsUpdate = true;
      this.cores[t].instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * @param {number} dt scaled seconds
   * @param {number} levelSpeedMul §1.8 tempo multiplier for the current level
   */
  update(dt, levelSpeedMul) {
    if (this.aliveCount === 0) return;

    // Continuous bob: per-row sinusoid — cheap (55 composes), keeps the fleet alive.
    // The flip-parity squash is held between steps (classic two-frame walk).
    const t = performance.now() * 0.002;
    const squash = this.flipParity === 0 ? 1 : 0.92;
    for (let r = 0; r < ROWS; r++) {
      const bobY = Math.sin(t + r * 0.9) * 0.12;
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (!this.aliveArr[i]) continue;
        const x = this.originX + (c - (COLS - 1) / 2) * DX;
        const y = this.originY - r * DY + bobY;
        const tIdx = this.invType[i];
        const s = this.invSlot[i];
        composeInstance(this.bodies[tIdx], s, x, y, 0, 1, squash);
        composeInstance(this.cores[tIdx], s, x, y + 0.15, 0, 1, squash);
      }
    }
    for (let t = 0; t < 3; t++) {
      this.bodies[t].instanceMatrix.needsUpdate = true;
      this.cores[t].instanceMatrix.needsUpdate = true;
    }

    // Discrete step march.
    this.stepTimer += dt;
    const period = this.stepPeriod(levelSpeedMul);
    let guard = 0;
    while (this.stepTimer >= period && this.aliveCount > 0 && guard++ < 8) {
      this.stepTimer -= period;
      this.doStep();
    }
  }

  reset(originY, dir = 1) {
    for (let i = 0; i < N; i++) this.aliveArr[i] = 1;
    this.aliveCount = N;
    this.originX = 0;
    this.originY = originY;
    this.dir = dir;
    this.stepTimer = 0.6; // brief pause before first step
    this.flipParity = 0;
    this._writeAll();
  }

  get allDead() { return this.aliveCount === 0; }
}

// ===========================================================================
// BulletSystem — pooled player + enemy bullets (InstancedMesh, one draw call each).
// ===========================================================================

const PLAYER_BULLET_MAX = 6;   // classic: 1 live at a time; pool headroom for SPREAD
const ENEMY_BULLET_MAX = 9;    // saturation cap rises with level (§1.5)

function makeBulletMesh(scene, track, count, colorHex, len) {
  const geo = new THREE.BoxGeometry(0.3, len, 0.3);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a0f18, emissive: colorHex, emissiveIntensity: 2.6,
    metalness: 0.2, roughness: 0.4
  });
  track(geo); track(mat);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Park all instances far below the arena until activated.
  for (let i = 0; i < count; i++) composeInstance(mesh, i, 0, -999, 0, 0.0001, 0.0001);
  scene.add(mesh);
  return mesh;
}

export class BulletSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {(r: THREE.BufferGeometry|THREE.Material)=>void} track
   */
  constructor(scene, track) {
    this.scene = scene;
    this.playerMesh = makeBulletMesh(scene, track, PLAYER_BULLET_MAX, 0x54f6ff, 1.2);
    this.enemyMesh = makeBulletMesh(scene, track, ENEMY_BULLET_MAX, 0xff7a3c, 1.0);

    const mkSlots = (n) => {
      const arr = new Array(n);
      for (let i = 0; i < n; i++) {
        arr[i] = { active: false, x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0 };
      }
      return arr;
    };
    this.playerSlots = mkSlots(PLAYER_BULLET_MAX);
    this.enemySlots = mkSlots(ENEMY_BULLET_MAX);

    // Per-slot invisible anchors (Object3D) so MotionTrails can follow each
    // bullet's real position — the InstancedMesh origin is always (0,0,0).
    const mkAnchors = (n) => {
      const arr = new Array(n);
      for (let i = 0; i < n; i++) {
        const a = new THREE.Object3D();
        a.position.set(0, -999, 0);
        scene.add(a);
        arr[i] = a;
      }
      return arr;
    };
    this.playerAnchors = mkAnchors(PLAYER_BULLET_MAX);
    this.enemyAnchors = mkAnchors(ENEMY_BULLET_MAX);

    this._playerLive = 0;
    this._enemyLive = 0;
  }

  get playerLiveCount() { return this._playerLive; }
  get enemyLiveCount() { return this._enemyLive; }

  /** @returns {number} slot index (≥ 0), or -1 when the pool is saturated */
  spawnPlayer(x, angleRad = 0) {
    const arr = this.playerSlots;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].active) continue;
      const slot = arr[i];
      slot.active = true;
      slot.x = x; slot.y = 3.4;
      slot.prevX = x; slot.prevY = 3.4;
      slot.vx = Math.sin(angleRad) * 55;
      slot.vy = Math.cos(angleRad) * 55;
      this.playerAnchors[i].position.set(slot.x, slot.y, 0);
      this._playerLive++;
      return i;
    }
    return -1;
  }

  /** @returns {number} slot index (≥ 0), or -1 when saturated (classic bullet pressure) */
  spawnEnemy(x, y, jitterRad) {
    const arr = this.enemySlots;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].active) continue;
      const slot = arr[i];
      slot.active = true;
      slot.x = x; slot.y = y;
      slot.prevX = x; slot.prevY = y;
      slot.vx = Math.sin(jitterRad) * 16;
      slot.vy = -Math.cos(jitterRad) * 16;
      this.enemyAnchors[i].position.set(x, y, 0);
      this._enemyLive++;
      return i;
    }
    return -1;
  }

  /** Deactivate + park the instance and its trail anchor. */
  _deactivate(arr, mesh, anchors, i) {
    arr[i].active = false;
    composeInstance(mesh, i, 0, -999, 0, 0.0001, 0.0001);
    mesh.instanceMatrix.needsUpdate = true;
    // Park the anchor so MotionTrails detaches immediately (it drops invisible objects).
    const a = anchors[i];
    if (a.visible) { a.position.set(0, -999, 0); a.visible = false; }
  }

  /** Kill a player bullet from collision code (Game.js). */
  killPlayerBullet(i) { this._deactivate(this.playerSlots, this.playerMesh, this.playerAnchors, i); }
  /** Kill an enemy bullet from collision code (Game.js). */
  killEnemyBullet(i) { this._deactivate(this.enemySlots, this.enemyMesh, this.enemyAnchors, i); }

  /**
   * @param {number} dt scaled seconds
   * @param {number} enemySpeed base u/s for the current level (§1.5)
   */
  update(dt, enemySpeed) {
    // Player bullets.
    const pArr = this.playerSlots;
    let live = 0;
    for (let i = 0; i < pArr.length; i++) {
      const s = pArr[i];
      if (!s.active) {
        // Park hidden anchors so attached trails detach (MotionTrails drops invisible objects).
        const pa = this.playerAnchors[i];
        if (pa.visible) { pa.position.set(0, -999, 0); pa.visible = false; }
        continue;
      }
      s.prevX = s.x; s.prevY = s.y; // swept-segment start (collision uses prev→current)
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > 31.5 || s.x < -21 || s.x > 21) {
        this._deactivate(pArr, this.playerMesh, this.playerAnchors, i);
        continue;
      }
      live++;
      composeInstance(this.playerMesh, i, s.x, s.y, 0, 1, 1);
      const pa = this.playerAnchors[i];
      pa.position.set(s.x, s.y, 0);
      if (!pa.visible) pa.visible = true; // trail follows the anchor while live
    }
    if (live !== this._playerLive) {
      this._playerLive = live;
      this.playerMesh.instanceMatrix.needsUpdate = true;
    } else if (this._playerLive > 0) {
      this.playerMesh.instanceMatrix.needsUpdate = true; // positions moved
    }

    // Enemy bullets.
    const eArr = this.enemySlots;
    let elive = 0;
    for (let i = 0; i < eArr.length; i++) {
      const s = eArr[i];
      if (!s.active) continue;
      s.prevX = s.x; s.prevY = s.y; // swept-segment start (collision uses prev→current)
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y < -1.5 || s.x < -21 || s.x > 21) {
        this._deactivate(eArr, this.enemyMesh, this.enemyAnchors, i);
        continue;
      }
      elive++;
      composeInstance(this.enemyMesh, i, s.x, s.y, 0, 1, 1);
      const ea = this.enemyAnchors[i];
      ea.position.set(s.x, s.y, 0);
      if (!ea.visible) ea.visible = true; // trail follows the anchor while live
    }
    if (elive !== this._enemyLive) {
      this._enemyLive = elive;
      this.enemyMesh.instanceMatrix.needsUpdate = true;
    } else if (this._enemyLive > 0) {
      this.enemyMesh.instanceMatrix.needsUpdate = true; // positions moved
    }
  }

  clearAll() {
    for (let i = 0; i < this.playerSlots.length; i++) {
      if (this.playerSlots[i].active) this._deactivate(this.playerSlots, this.playerMesh, this.playerAnchors, i);
    }
    for (let i = 0; i < this.enemySlots.length; i++) {
      if (this.enemySlots[i].active) this._deactivate(this.enemySlots, this.enemyMesh, this.enemyAnchors, i);
    }
    this._playerLive = 0;
    this._enemyLive = 0;
  }
}

// ===========================================================================
// Bunkers — one InstancedMesh of unit cubes for all four shields.
// Erosion is event-driven: matrices are rewritten only when a cell dies.
// ===========================================================================

import { BUNKER_COLS as BK_COLS, BUNKER_ROWS as BK_ROWS, CELL_SIZE as BK_CELL } from './LevelGenerator.js';
export const BUNKER_CENTERS_X = [-15, -5, 5, 15];
const BUNKER_BASE_Y = 6.0;

// Mask convention (matches LevelGenerator.bunkerMask): index r*COLS+c with
// r=0 at the TOP of the bunker; world y decreases as r grows.
export class Bunkers {
  /**
   * @param {THREE.Scene} scene
   * @param {(r: THREE.BufferGeometry|THREE.Material)=>void} track
   */
  constructor(scene, track) {
    this.scene = scene;
    const total = BK_COLS * BK_ROWS * BUNKER_CENTERS_X.length;

    const geo = new THREE.BoxGeometry(1, 1, DEPTH);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2fe8a0, metalness: 0.45, roughness: 0.5,
      emissive: 0x0f5c3a, emissiveIntensity: 0.55
    });
    track(geo); track(mat);

    this.mesh = new THREE.InstancedMesh(geo, mat, total);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);

    // Per-bunker state.
    this.grids = [];       // Uint8Array(BK_COLS*BK_ROWS) per bunker (1 = solid cell)
    this._rng = mulberry32(1337);

    this.reset();
  }

  /** Rebuild all bunker cell state from fresh masks (LevelGenerator.bunkerMask()). */
  reset(masks) {
    if (!masks || masks.length !== BUNKER_CENTERS_X.length) {
      // First-time default: same SDF silhouette as LevelGenerator.
      const cx = (BK_COLS - 1) / 2;
      const archR = 8 * BK_CELL;
      const hw = (BK_COLS / 2) * BK_CELL - BK_CELL * 0.5;
      const hh = (BK_ROWS / 2) * BK_CELL - BK_CELL * 0.5;
      masks = new Array(BUNKER_CENTERS_X.length);
      for (let b = 0; b < BUNKER_CENTERS_X.length; b++) {
        const m = new Uint8Array(BK_COLS * BK_ROWS);
        for (let r = 0; r < BK_ROWS; r++) {
          for (let c = 0; c < BK_COLS; c++) {
            const lx = (c - cx) * BK_CELL;
            const ly = (BK_ROWS - 1 - r) * BK_CELL + BK_CELL / 2; // base-relative, +y up
            const rx = Math.max(0, Math.abs(lx) - (hw - 1.2));
            const ry = Math.max(0, ly - (hh - 1.2));
            if (rx > 0 && ry > 0 && Math.hypot(rx, ry) > 1.2) continue; // outside rounded rect
            if (ly < archR && Math.hypot(lx, ly) < archR - 0.35) continue; // bottom arch
            m[r * BK_COLS + c] = 1;
          }
        }
        masks[b] = m;
      }
    }
    for (let b = 0; b < BUNKER_CENTERS_X.length; b++) {
      const g = new Uint8Array(BK_COLS * BK_ROWS);
      const src = masks[b];
      for (let i = 0; i < g.length; i++) g[i] = src[i] ? 1 : 0; // normalize boolean[] → Uint8
      this.grids[b] = g;
    }
    this._rebuildAll();
  }

  /** World position of cell (r, c) in bunker b. r=0 is the TOP row. */
  _cellWorld(b, r, c) {
    const x = BUNKER_CENTERS_X[b] + (c - (BK_COLS - 1) / 2) * BK_CELL;
    const y = BUNKER_BASE_Y + ((BK_ROWS - 1) / 2 - r) * BK_CELL;
    return { x, y };
  }

  _rebuildAll() {
    let idx = 0;
    for (let b = 0; b < BUNKER_CENTERS_X.length; b++) {
      const g = this.grids[b];
      for (let r = 0; r < BK_ROWS; r++) {
        for (let c = 0; c < BK_COLS; c++) {
          if (g[r * BK_COLS + c]) {
            const w = this._cellWorld(b, r, c);
            composeInstance(this.mesh, idx, w.x, w.y, 0, BK_CELL, BK_CELL);
          } else {
            composeInstance(this.mesh, idx, 0, -999, 0, 0.0001, 0.0001);
          }
          idx++;
        }
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Test a world point against bunker cells. If it hits a live cell, erode it
   * plus 1–3 random neighbors (Chebyshev ≤ 2) and return the hit cell's world pos.
   * @returns {{x:number,y:number}|null}
   */
  hitAt(x, y) {
    for (let b = 0; b < BUNKER_CENTERS_X.length; b++) {
      const cx = BUNKER_CENTERS_X[b];
      if (Math.abs(x - cx) > BK_COLS * BK_CELL / 2 + 0.3) continue;
      if (y < BUNKER_BASE_Y - BK_ROWS * BK_CELL / 2 || y > BUNKER_BASE_Y + BK_ROWS * BK_CELL / 2) continue;

      const c = Math.round((x - cx) / BK_CELL + (BK_COLS - 1) / 2);
      // r=0 is the top row → world y decreases as r grows.
      const r = Math.round(((BUNKER_BASE_Y + (BK_ROWS - 1) * BK_CELL / 2) - y) / BK_CELL);
      if (c < 0 || c >= BK_COLS || r < 0 || r >= BK_ROWS) continue;

      const g = this.grids[b];
      const idxCell = r * BK_COLS + c;
      if (!g[idxCell]) continue; // dead cell → bullet passes through the crater

      // Erode: struck cell + random neighbors.
      g[idxCell] = 0;
      const extra = 1 + Math.floor(this._rng() * 3); // 1..3
      for (let k = 0; k < extra; k++) {
        // Random neighbor within Chebyshev distance ≤ 2.
        let nc, nr, dc = 0, dr = 0, tries = 0;
        do {
          dc = Math.floor(this._rng() * 5) - 2;
          dr = Math.floor(this._rng() * 5) - 2;
          nc = c + dc; nr = r + dr;
          tries++;
        } while ((nc < 0 || nc >= BK_COLS || nr < 0 || nr >= BK_ROWS || (dc === 0 && dr === 0)) && tries < 12);
        if (nc >= 0 && nc < BK_COLS && nr >= 0 && nr < BK_ROWS) {
          g[nr * BK_COLS + nc] = 0;
        }
      }

      this._rebuildBunker(b);
      const w = this._cellWorld(b, r, c);
      return w;
    }
    return null;
  }

  /** Rebuild only bunker b's instances (event-driven, ≤ 352 composes). */
  _rebuildBunker(b) {
    let idx = b * BK_COLS * BK_ROWS;
    const g = this.grids[b];
    for (let r = 0; r < BK_ROWS; r++) {
      for (let c = 0; c < BK_COLS; c++) {
        if (g[r * BK_COLS + c]) {
          const w = this._cellWorld(b, r, c);
          composeInstance(this.mesh, idx, w.x, w.y, 0, BK_CELL, BK_CELL);
        } else {
          composeInstance(this.mesh, idx, 0, -999, 0, 0.0001, 0.0001);
        }
        idx++;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ===========================================================================
// UFO — mystery ship. Single mesh group; schedule owned by Game.
// ===========================================================================
export class UFO {
  /**
   * @param {THREE.Scene} scene
   * @param {(r: THREE.BufferGeometry|THREE.Material)=>void} track
   */
  constructor(scene, track) {
    this.scene = scene;

    const bodyGeo = buildVoxelGeometry(MAP_UFO);
    const coreGeo = new THREE.BoxGeometry(3.4, 0.7, DEPTH + 0.4);
    const bodyMat = makeBodyMaterial(0xffd27a);
    const coreMat = makeCoreMaterial(0xff3c8e);
    track(bodyGeo); track(coreGeo); track(bodyMat); track(coreMat);

    this.group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = -0.4;
    this.group.add(body, core);
    this.body = body;
    this.core = core;
    scene.add(this.group);

    this.active = false;
    this.x = 0;
    this.dir = 1;
    this.speed = 9;
    this.value = 100;
    this.y = 27.5;
    this.group.visible = false;
  }

  spawn(dir, value) {
    this.active = true;
    this.dir = dir;
    this.value = value;
    this.x = dir > 0 ? -24 : 24;
    this.group.position.set(this.x, this.y, 0);
    this.group.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    this.x += this.dir * this.speed * dt;
    if (Math.abs(this.x) > 24.5) {
      // Left the arena — deactivate silently (no score).
      this.active = false;
      this.group.visible = false;
      return;
    }
    this.group.position.x = this.x;
    // Slight hover bob for life.
    const t = performance.now() * 0.003;
    this.group.position.y = this.y + Math.sin(t) * 0.15;
    // Core pulse (bloom pickup).
    this.core.material.emissiveIntensity = 2.2 + Math.sin(t * 2) * 0.6;
  }

  /** AABB half-extents for collision tests. */
  getHalfExtents(out) { out.hw = 3.4; out.hh = 1.4; return out; }
}

// ===========================================================================
// PowerUpSystem — pooled octahedra, color-coded by type.
// Types: RAPID · SPREAD · SHIELD · SLOW
// ===========================================================================
export const POWERUP_TYPES = {
  RAPID:  { color: 0x54f6ff, label: 'RAPID' },
  SPREAD: { color: 0xffd23c, label: 'SPREAD' },
  SHIELD: { color: 0x7dff9e, label: 'SHIELD' },
  SLOW:   { color: 0xc58cff, label: 'SLOW' }
};

export class PowerUpSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {(r: THREE.BufferGeometry|THREE.Material)=>void} track
   */
  constructor(scene, track) {
    this.scene = scene;
    const geo = new THREE.OctahedronGeometry(0.75);
    track(geo);

    this.slots = [];
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x111826, emissive: 0xffffff, emissiveIntensity: 2.0,
        metalness: 0.3, roughness: 0.4
      });
      track(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.slots.push({ active: false, type: null, x: 0, y: 0, mesh, mat });
    }
  }

  /** @returns {boolean} false when saturated */
  spawn(type, x, y) {
    const slot = this.slots.find(s => !s.active);
    if (!slot) return false;
    slot.active = true;
    slot.type = type;
    slot.x = x;
    slot.y = y;
    const def = POWERUP_TYPES[type];
    slot.mat.emissive.setHex(def.color);
    slot.mesh.position.set(x, y, 0);
    slot.mesh.visible = true;
    return true;
  }

  /** @returns {string|null} type collected this frame (Game applies the effect) */
  update(dt, playerX, playerY) {
    let collected = null;
    for (const s of this.slots) {
      if (!s.active) continue;
      s.y -= 6 * dt; // fall speed
      s.mesh.position.set(s.x, s.y, 0);
      s.mesh.rotation.y += dt * 3.2;
      s.mesh.rotation.x += dt * 1.7;

      if (s.y < 1) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      // Pickup radius 2.2 u around player.
      const dx = s.x - playerX, dy = s.y - playerY;
      if (dx * dx + dy * dy < 2.2 * 2.2) {
        collected = s.type;
        s.active = false;
        s.mesh.visible = false;
      }
    }
    return collected;
  }

  clearAll() {
    for (const s of this.slots) {
      if (s.active) {
        s.active = false;
        s.mesh.visible = false;
      }
    }
  }
}
