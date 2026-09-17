// The 5 × 11 formation: discrete logical grid stepping (classic tempo model) plus instanced voxel
// rendering with fly-in and hop-ripple animation. Collision always uses logical positions.
import { InstancedMesh, Matrix4, Vector3, Quaternion, DynamicDrawUsage } from 'three';
import { bitmapToGeometry } from '@shared/procgen/GeometryUtils.js';
import { neonMaterial } from '@shared/procgen/MaterialLibrary.js';
import { Easing } from '@shared/math/Easing.js';
import { clamp } from '@shared/math/MathUtils.js';
import { setAabb } from '@shared/math/Collision.js';
import { INVADER_BITMAPS, INVADER_TYPES, ROW_TYPES } from '../data/InvaderBitmaps.js';
import { WORLD, FORMATION, INVADER_FIRE } from '../config.js';

const TYPE_NAMES = ['squid', 'crab', 'octopus'];
const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();

export class InvaderFormation {
  /**
   * @param {import('three').Scene} scene
   * @param {import('@shared/core/ResourceTracker.js').ResourceTracker} tracker
   * @param {import('@shared/procgen/Random.js').Random} random
   * @param {import('@shared/core/EventBus.js').EventBus} events
   */
  constructor(scene, tracker, random, events) {
    this.scene = scene;
    this.random = random;
    this.events = events;

    const { COLS, ROWS } = FORMATION;
    this.cols = COLS;
    this.rows = ROWS;
    this.total = COLS * ROWS;

    this.alive = new Uint8Array(this.total);
    this.typeIndex = new Uint8Array(this.total);
    this.slot = new Uint16Array(this.total);
    this.colAlive = new Uint8Array(COLS);

    const typeCounts = [0, 0, 0];
    for (let r = 0; r < ROWS; r++) {
      const ti = TYPE_NAMES.indexOf(ROW_TYPES[r]);
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        this.typeIndex[i] = ti;
        this.slot[i] = typeCounts[ti]++;
      }
    }

    this.halfW = new Float32Array(3);
    this.halfH = new Float32Array(3);
    this.materials = [];
    this.meshes = [];
    for (let ti = 0; ti < 3; ti++) {
      const name = TYPE_NAMES[ti];
      const def = INVADER_TYPES[name];
      const material = tracker.track(
        neonMaterial({ color: 0x07070f, emissive: def.color, intensity: def.intensity, roughness: 0.4, metalness: 0.2 }),
      );
      this.materials.push(material);
      const pair = [];
      for (let f = 0; f < 2; f++) {
        const built = bitmapToGeometry(INVADER_BITMAPS[name][f], { cell: FORMATION.VOXEL, depth: FORMATION.VOXEL_DEPTH });
        tracker.track(built.geometry);
        this.halfW[ti] = built.halfWidth;
        this.halfH[ti] = built.halfHeight;
        const mesh = new InstancedMesh(built.geometry, material, typeCounts[ti]);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.count = typeCounts[ti];
        mesh.name = `Invaders_${name}_${f}`;
        mesh.visible = f === 0;
        scene.add(mesh);
        tracker.track(mesh);
        pair.push(mesh);
      }
      this.meshes.push(pair);
    }

    this.originX = 0;
    this.originY = WORLD.FORMATION_TOP_Y;
    this.dir = 1;
    this.timer = 0;
    this.pendingDrop = false;
    this.frame = 0;
    this.demo = false;
    this.frozen = true;
    this.count = this.total;
    this.hopClock = 10;
    this.flyClock = 0;
    this.flyTotal = 0;
    this.flying = false;
    this.fireTimer = 1;
    this.params = {
      speedMul: 1,
      maxShots: INVADER_FIRE.BASE_MAX_SHOTS,
      fireMin: INVADER_FIRE.INTERVAL_MIN,
      fireMax: INVADER_FIRE.INTERVAL_MAX,
      fireScale: 1,
      bulletSpeed: INVADER_FIRE.SPEED,
      startDrop: 0,
      aimedChance: INVADER_FIRE.AIMED_CHANCE,
      graceTime: INVADER_FIRE.GRACE_TIME,
    };
    this.lastInterval = 1;
    this._bounds = { minX: 0, maxX: 0, maxHalfW: 0, lowestBottom: 0, lowestRow: 0 };
    this.reset(1, { demo: true, flyIn: false });
  }

  /** Per-wave tuning from WaveDirector. */
  setParams(params) {
    this.params = params;
  }

  /** Hold fire for a moment (used right after the cannon respawns). */
  grace(seconds = this.params.graceTime) {
    this.fireTimer = Math.max(this.fireTimer, seconds);
  }

  reset(wave, { demo = false, flyIn = true } = {}) {
    this.alive.fill(1);
    this.colAlive.fill(this.rows);
    this.count = this.total;
    this.originX = -((this.cols - 1) * FORMATION.COL_PITCH) / 2;
    const startDrop = Math.min(wave - 1, FORMATION.START_DROP_CAP) * FORMATION.DROP_Y;
    this.originY = WORLD.FORMATION_TOP_Y - startDrop;
    this.dir = 1;
    this.timer = 0;
    this.pendingDrop = false;
    this.frame = 0;
    this.demo = demo;
    this.hopClock = 10;
    this.fireTimer = this.random.range(1.6, 2.4);
    this.flying = flyIn;
    this.flyClock = 0;
    this.flyTotal =
      (this.rows - 1) * FORMATION.FLY_IN_ROW_DELAY + (this.cols - 1) * FORMATION.FLY_IN_COL_DELAY + FORMATION.FLY_IN_DURATION;
    this.frozen = flyIn;
    this.meshes.forEach((pair) => {
      pair[0].visible = true;
      pair[1].visible = false;
    });
    this.writeMatrices();
  }

  get flyInDone() {
    return !this.flying || this.flyClock >= this.flyTotal;
  }

  get aliveCount() {
    return this.count;
  }

  typeOf(i) {
    return TYPE_NAMES[this.typeIndex[i]];
  }

  logicalX(i) {
    return this.originX + (i % this.cols) * FORMATION.COL_PITCH;
  }

  logicalY(i) {
    return this.originY - Math.floor(i / this.cols) * FORMATION.ROW_PITCH;
  }

  /** Collision half-extents for invader `i` (slightly inset from the sprite). */
  halfWidthOf(i) {
    return this.halfW[this.typeIndex[i]] - FORMATION.COLLISION_SHRINK;
  }

  halfHeightOf(i) {
    return this.halfH[this.typeIndex[i]] - FORMATION.COLLISION_SHRINK;
  }

  aabbOf(i, out) {
    return setAabb(out, this.logicalX(i), this.logicalY(i), this.halfWidthOf(i), this.halfHeightOf(i));
  }

  /** Current step interval from the classic "one alien per frame" tempo model. */
  stepInterval() {
    const base = clamp(this.count / FORMATION.FRAMES_PER_ALIEN, FORMATION.MIN_STEP_INTERVAL, FORMATION.MAX_STEP_INTERVAL);
    return base / this.params.speedMul;
  }

  /** min/max logical x over living invaders, and the lowest living bottom edge. */
  aliveBounds(out) {
    let minCol = this.cols;
    let maxCol = -1;
    for (let c = 0; c < this.cols; c++) {
      if (this.colAlive[c] > 0) {
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }
    }
    let lowestRow = -1;
    let lowestHalf = 0;
    for (let r = this.rows - 1; r >= 0 && lowestRow < 0; r--) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        if (this.alive[i]) {
          lowestRow = r;
          lowestHalf = this.halfH[this.typeIndex[i]];
          break;
        }
      }
    }
    out.minX = maxCol < 0 ? 0 : this.originX + minCol * FORMATION.COL_PITCH;
    out.maxX = maxCol < 0 ? 0 : this.originX + maxCol * FORMATION.COL_PITCH;
    out.maxHalfW = Math.max(this.halfW[0], this.halfW[1], this.halfW[2]);
    out.lowestBottom = lowestRow < 0 ? Infinity : this.originY - lowestRow * FORMATION.ROW_PITCH - lowestHalf;
    out.lowestRow = lowestRow;
    return out;
  }

  /** Lowest living invader centre y (Infinity when empty). */
  lowestY() {
    for (let r = this.rows - 1; r >= 0; r--) {
      for (let c = 0; c < this.cols; c++) {
        if (this.alive[r * this.cols + c]) return this.originY - r * FORMATION.ROW_PITCH;
      }
    }
    return Infinity;
  }

  forEachAlive(fn) {
    for (let i = 0; i < this.total; i++) {
      if (this.alive[i]) fn(i, this.logicalX(i), this.logicalY(i), this.typeIndex[i]);
    }
  }

  /** Kill invader `i`. Returns descriptive info or null if already dead. */
  kill(i) {
    if (!this.alive[i]) return null;
    this.alive[i] = 0;
    this.colAlive[i % this.cols]--;
    this.count--;
    const name = this.typeOf(i);
    const def = INVADER_TYPES[name];
    return {
      index: i,
      type: name,
      points: def.points,
      color: def.color,
      pitch: def.pitch,
      x: this.logicalX(i),
      y: this.logicalY(i),
    };
  }

  /** Bottom-most living invader in column `c`, or -1. */
  bottomOfColumn(c) {
    for (let r = this.rows - 1; r >= 0; r--) {
      const i = r * this.cols + c;
      if (this.alive[i]) return i;
    }
    return -1;
  }

  /** Choose a shooter: 35 % aimed at the player's column, otherwise a random living column. */
  chooseShooter(playerX) {
    let liveCols = 0;
    for (let c = 0; c < this.cols; c++) if (this.colAlive[c] > 0) liveCols++;
    if (liveCols === 0) return -1;

    if (this.random.chance(this.params.aimedChance ?? INVADER_FIRE.AIMED_CHANCE)) {
      let best = -1;
      let bestDist = Infinity;
      for (let c = 0; c < this.cols; c++) {
        if (this.colAlive[c] === 0) continue;
        const d = Math.abs(this.originX + c * FORMATION.COL_PITCH - playerX);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      return this.bottomOfColumn(best);
    }

    let pick = this.random.int(0, liveCols - 1);
    for (let c = 0; c < this.cols; c++) {
      if (this.colAlive[c] === 0) continue;
      if (pick === 0) return this.bottomOfColumn(c);
      pick--;
    }
    return -1;
  }

  /**
   * Logical step. `ctx` = { playerX, liveShots, canShoot }.
   * Emits invader:step / invader:drop / invader:invaded / invader:fire.
   */
  fixedUpdate(step, ctx) {
    if (this.frozen || this.count === 0) return;

    this.timer += step;
    const interval = this.stepInterval();
    this.lastInterval = interval;
    if (this.timer >= interval) {
      this.timer -= interval;
      if (this.timer > interval) this.timer = 0;

      if (this.pendingDrop) {
        if (!this.demo) this.originY -= FORMATION.DROP_Y;
        this.dir = -this.dir;
        this.pendingDrop = false;
        if (!this.demo) this.events.emit('invader:drop', { originY: this.originY, lowestY: this.lowestY() });
      } else {
        this.originX += this.dir * FORMATION.STEP_X;
        const b = this.aliveBounds(this._bounds);
        const limit = WORLD.HALF_WIDTH - FORMATION.EDGE_MARGIN;
        if (
          (this.dir > 0 && b.maxX + b.maxHalfW >= limit) ||
          (this.dir < 0 && b.minX - b.maxHalfW <= -limit)
        ) {
          this.pendingDrop = true;
        }
      }

      this.frame ^= 1;
      this.hopClock = 0;
      for (let ti = 0; ti < 3; ti++) {
        this.meshes[ti][0].visible = this.frame === 0;
        this.meshes[ti][1].visible = this.frame === 1;
      }
      this.events.emit('invader:step', { aliveCount: this.count, frame: this.frame, interval });

      if (!this.demo) {
        const b = this.aliveBounds(this._bounds);
        if (b.lowestBottom <= WORLD.INVASION_Y) this.events.emit('invader:invaded', { lowestBottom: b.lowestBottom });
      }
    }

    if (this.demo || !ctx || !ctx.canShoot) return;

    this.fireTimer -= step;
    if (this.fireTimer <= 0) {
      if (ctx.liveShots < this.params.maxShots) {
        const shooter = this.chooseShooter(ctx.playerX);
        if (shooter >= 0) {
          const kind = this.random.weighted(INVADER_FIRE.KINDS, INVADER_FIRE.KIND_WEIGHTS);
          this.events.emit('invader:fire', {
            index: shooter,
            x: this.logicalX(shooter),
            y: this.logicalY(shooter) - INVADER_FIRE.MUZZLE_OFFSET,
            kind,
            speed: this.params.bulletSpeed,
          });
        }
      }
      const aliveFrac = this.count / this.total;
      const base = this.random.range(this.params.fireMin, this.params.fireMax);
      this.fireTimer = Math.max(0.2, base * (0.55 + 0.45 * aliveFrac) * this.params.fireScale);
    }
  }

  /** Visual update: fly-in, hop ripple, matrix write. */
  update(dt) {
    if (this.flying) {
      this.flyClock += dt;
      if (this.flyClock >= this.flyTotal) {
        this.flying = false;
        this.flyClock = this.flyTotal;
      }
    }
    this.hopClock += dt;
    this.writeMatrices();
  }

  writeMatrices() {
    const cols = this.cols;
    const hop = this.hopClock;
    const flyActive = this.flying;
    _q.identity();
    for (let i = 0; i < this.total; i++) {
      const ti = this.typeIndex[i];
      const mesh = this.meshes[ti][this.frame];
      if (!this.alive[i]) {
        _s.set(0, 0, 0);
        _p.set(0, -100, 0);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(this.slot[i], _m);
        continue;
      }
      const c = i % cols;
      const r = (i - c) / cols;
      let x = this.originX + c * FORMATION.COL_PITCH;
      let y = this.originY - r * FORMATION.ROW_PITCH;
      let sx = 1;
      let sy = 1;

      if (flyActive) {
        const delay = r * FORMATION.FLY_IN_ROW_DELAY + c * FORMATION.FLY_IN_COL_DELAY;
        const t = clamp((this.flyClock - delay) / FORMATION.FLY_IN_DURATION, 0, 1);
        const e = Easing.easeOutCubic(t);
        y += FORMATION.FLY_IN_HEIGHT * (1 - e);
        const sc = 0.3 + 0.7 * e;
        sx *= sc;
        sy *= sc;
      }

      const ht = clamp((hop - c * FORMATION.HOP_COL_DELAY) / FORMATION.HOP_DURATION, 0, 1);
      if (ht > 0 && ht < 1) {
        const pulse = Math.sin(ht * Math.PI);
        y += 0.12 * pulse;
        sy *= 1 + 0.18 * pulse;
        sx *= 1 - 0.1 * pulse;
      }

      _p.set(x, y, 0);
      _s.set(sx, sy, 1);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(this.slot[i], _m);
    }
    for (let ti = 0; ti < 3; ti++) this.meshes[ti][this.frame].instanceMatrix.needsUpdate = true;
  }

  setVisible(visible) {
    for (let ti = 0; ti < 3; ti++) {
      this.meshes[ti][0].visible = visible && this.frame === 0;
      this.meshes[ti][1].visible = visible && this.frame === 1;
    }
  }

  dispose() {
    for (const pair of this.meshes) {
      for (const mesh of pair) {
        this.scene.remove(mesh);
        mesh.dispose();
      }
    }
    // Geometries and materials are owned by the ResourceTracker.
  }
}
