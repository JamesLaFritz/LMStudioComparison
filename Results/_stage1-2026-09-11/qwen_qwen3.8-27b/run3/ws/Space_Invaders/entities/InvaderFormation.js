import * as THREE from 'three';
import { clamp, lerp, easeOutQuad } from '../../shared/math/Utils.js';
import { makeInvaderAtlas } from '../../shared/textures/ProceduralTextures.js';
import { segCircleHit } from '../systems/CollisionSystem.js';
import { BOUNDS, FORMATION, COLORS, SCORING } from '../config.js';

// Classic invader pixel maps (1 = body pixel). 11 wide x 8 tall.
const PIXELS = {
  squid: [
    '....X.X....',
    '...X...X...',
    '..XXXXXXX..',
    '.XX.XXX.XX.',
    'XXXXXXXXXXX',
    'X.XXXXXXX.X',
    'X.X.....X.X',
    '...XX.XX...',
  ],
  crab: [
    '...X...X...',
    '..X.....X..',
    '..XXXXXXX..',
    '.XXX.XXX.XX',
    'XXXXXXXXXXX',
    'X.XXXXXXX.X',
    'X.X.....X.X',
    'XX.X...X.XX',
  ],
  lobster: [
    '.X..XXX..X.',
    'XX.XXXX.XXX',
    'XXXXXXXXXXX',
    'XXX.XXX.XXX',
    '.XXXXXXXXX.',
    '...X.X.X...',
    'X..X.X.X..X',
    'XX.X...X.XX',
  ],
};

// Frame B: toggle the limb pixels (rows 6-7) for the classic 2-frame march.
function frameB(rows) {
  const out = rows.slice();
  out[6] = out[6].split('').map((c, i) => (i % 2 === 0 ? (c === 'X' ? '.' : 'X') : c)).join('');
  out[7] = out[7].split('').map((c, i) => (i % 2 === 0 ? (c === 'X' ? '.' : 'X') : c)).join('');
  return out;
}

const TYPE_DEFS = [
  { key: 'squid', color: COLORS.squid, points: SCORING.squid },
  { key: 'crab', color: COLORS.crab, points: SCORING.crab },
  { key: 'lobster', color: COLORS.lobster, points: SCORING.lobster },
];

export default class InvaderFormation {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../shared/core/MemoryRegistry.js').MemoryRegistry} registry
   */
  constructor(scene, registry) {
    this.scene = scene;
    this.registry = registry;

    this.rows = FORMATION.rows;
    this.cols = FORMATION.cols;
    this.cellX = FORMATION.cellX;
    this.cellY = FORMATION.cellY;
    this.formW = (this.cols - 1) * this.cellX;

    this.dir = 1;
    this.stepT = 0;
    this.alive = 0;
    this.wave = 1;
    this.speedMul = 1; // set by the game each frame (SLOW power-up)

    // March interpolation state
    this.prevX = 0;
    this.prevY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.renderX = 0;
    this.renderY = 0;
    this.animT = 1;
    this.animDur = FORMATION.animTime;

    // Per-type instance data
    this.byType = TYPE_DEFS.map(() => ({ list: [], mesh: null, mat: null, texA: null, texB: null, frame: 0 }));

    this._dummy = new THREE.Object3D();
    this._flash = new Map(); // "type:index" -> remaining flash time
    this._flashColor = new THREE.Color(0xffffff);
    this._baseColors = TYPE_DEFS.map((d) => new THREE.Color(d.color));

    this._buildMeshes();
  }

  _buildMeshes() {
    const geo = new THREE.BoxGeometry(1.7, 1.4, 0.3);
    this.registry.track(geo);

    for (let t = 0; t < 3; t++) {
      const def = TYPE_DEFS[t];
      const texA = makeInvaderAtlas(PIXELS[def.key], def.color, this.registry);
      const texB = makeInvaderAtlas(frameB(PIXELS[def.key]), def.color, this.registry);
      const mat = new THREE.MeshStandardMaterial({
        map: texA,
        emissiveMap: texA,
        emissive: new THREE.Color(def.color),
        emissiveIntensity: 1.6,
        color: 0xffffff,
        metalness: 0.35,
        roughness: 0.4,
      });
      this.registry.track(mat);
      this.registry.track(texA);
      this.registry.track(texB);

      const mesh = new THREE.InstancedMesh(geo, mat, this.rows * this.cols);
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.scene.add(mesh);

      this.byType[t].mesh = mesh;
      this.byType[t].mat = mat;
      this.byType[t].texA = texA;
      this.byType[t].texB = texB;
    }
  }

  /** (Re)spawn the full formation for a wave. */
  reset(topY, wave) {
    for (let t = 0; t < 3; t++) this.byType[t].list.length = 0;
    this.alive = 0;
    this.dir = 1;
    this.stepT = 0;
    this.wave = wave;
    this._flash.clear();

    const left = -this.formW / 2;
    const armorChance = wave >= FORMATION.armorChanceFromWave ? FORMATION.armorChance : 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const type = r === 0 ? 0 : r < 4 ? 1 : 2;
        const armored = Math.random() < armorChance;
        this.byType[type].list.push({
          row: r,
          col: c,
          hp: armored ? 2 : 1,
          baseX: left + c * this.cellX,
          baseY: -r * this.cellY,
        });
        this.alive++;
      }
    }

    this.targetX = left;
    this.targetY = topY;
    this.prevX = left;
    this.prevY = topY + 4; // fly in from above
    this.renderX = left;
    this.renderY = topY + 4;
    this.animT = 0;
    this.animDur = 0.9;

    this._writeAll();
  }

  /** Step interval from the acceleration curve (plan 1.3). */
  stepInterval() {
    const n = Math.max(1, this.alive);
    const tMax = Math.max(FORMATION.tMaxFloor, FORMATION.tMax - FORMATION.tMaxDropPerWave * (this.wave - 1));
    const base = FORMATION.tMin + (tMax - FORMATION.tMin) * Math.pow(n / (this.rows * this.cols), 0.7);
    // SLOW power-up lengthens the interval (speedMul >= 1).
    return base * (this.speedMul || 1);
  }

  /** March logic + render interpolation. */
  update(dt) {
    if (this.alive > 0 && this.animT >= 1) {
      this.stepT += dt;
      if (this.stepT >= this.stepInterval()) {
        this.stepT = 0;
        this._doStep();
      }
    }

    if (this.animT < 1) {
      this.animT = Math.min(1, this.animT + dt / this.animDur);
      const k = easeOutQuad(this.animT);
      this.renderX = lerp(this.prevX, this.targetX, k);
      this.renderY = lerp(this.prevY, this.targetY, k);
      this._writeAll();
    }

    if (this._flash.size > 0) {
      for (const [key, t] of this._flash) {
        const nt = t - dt;
        if (nt <= 0) {
          this._flash.delete(key);
          const [ti, idx] = key.split(':').map(Number);
          this.byType[ti].mesh.setColorAt(idx, this._baseColors[ti]);
          this.byType[ti].mesh.instanceColor.needsUpdate = true;
        } else {
          this._flash.set(key, nt);
        }
      }
    }
  }

  _doStep() {
    this.prevX = this.renderX;
    this.prevY = this.renderY;

    this.targetX += this.dir * FORMATION.stepX;
    if (this.dir > 0 && this.targetX + this.formW / 2 > BOUNDS.right) {
      this.targetX = BOUNDS.right - this.formW / 2;
      this.targetY -= FORMATION.drop;
      this.dir = -1;
    } else if (this.dir < 0 && this.targetX - this.formW / 2 < BOUNDS.left) {
      this.targetX = BOUNDS.left + this.formW / 2;
      this.targetY -= FORMATION.drop;
      this.dir = 1;
    }

    this.animT = 0;
    this.animDur = FORMATION.animTime;

    // 2-frame animation: swap the shared texture (all instances of a type in sync)
    for (let t = 0; t < 3; t++) {
      const bt = this.byType[t];
      bt.frame = 1 - bt.frame;
      const tex = bt.frame === 0 ? bt.texA : bt.texB;
      bt.mat.map = tex;
      bt.mat.emissiveMap = tex;
    }
  }

  _worldPos(inv) {
    return { x: this.renderX + inv.baseX, y: this.renderY + inv.baseY };
  }

  _writeAll() {
    const d = this._dummy;
    for (let t = 0; t < 3; t++) {
      const bt = this.byType[t];
      const list = bt.list;
      for (let i = 0; i < list.length; i++) {
        const p = this._worldPos(list[i]);
        d.position.set(p.x, p.y, 0);
        d.rotation.set(0, 0, 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        bt.mesh.setMatrixAt(i, d.matrix);
      }
      bt.mesh.count = list.length;
      bt.mesh.instanceMatrix.needsUpdate = true;
      if (bt.mesh.instanceColor) bt.mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Find the invader at a world point (radius r). Returns {type, index} or null. */
  findInvader(x, y, r) {
    for (let t = 0; t < 3; t++) {
      const list = this.byType[t].list;
      for (let i = 0; i < list.length; i++) {
        const p = this._worldPos(list[i]);
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy <= r * r) return { type: t, index: i };
      }
    }
    return null;
  }

  /**
   * Swept find: test the segment (x0,y0)→(x1,y1) against every live invader
   * (circle radius r). Prevents fast bullets tunneling through a body in a
   * single frame. Returns {type, index} or null.
   */
  findInvaderSeg(x0, y0, x1, y1, r) {
    for (let t = 0; t < 3; t++) {
      const list = this.byType[t].list;
      for (let i = 0; i < list.length; i++) {
        const p = this._worldPos(list[i]);
        if (segCircleHit(x0, y0, x1, y1, p.x, p.y, r)) return { type: t, index: i };
      }
    }
    return null;
  }

  /** Kill (or armor-hit) the invader at {type, index}. Returns 'killed' | 'armored'. */
  hitInvader(hit) {
    const bt = this.byType[hit.type];
    const inv = bt.list[hit.index];
    inv.hp--;
    if (inv.hp > 0) {
      bt.mesh.setColorAt(hit.index, this._flashColor);
      bt.mesh.instanceColor.needsUpdate = true;
      this._flash.set(`${hit.type}:${hit.index}`, 0.12);
      return 'armored';
    }
    const last = bt.list.length - 1;
    bt.list[hit.index] = bt.list[last];
    bt.list.pop();
    this.alive--;
    // Reconcile flash state with the compaction swap so no slot is left
    // permanently tinted and the swapped-in invader keeps its own flash.
    const iKey = `${hit.type}:${hit.index}`;
    const lastKey = `${hit.type}:${last}`;
    if (this._flash.has(lastKey)) {
      this._flash.set(iKey, this._flash.get(lastKey));
      this._flash.delete(lastKey);
    } else {
      this._flash.delete(iKey);
      bt.mesh.setColorAt(hit.index, this._baseColors[hit.type]);
      bt.mesh.instanceColor.needsUpdate = true;
    }
    this._writeAll();
    return 'killed';
  }

  /** Lowest live invader y (for game-over check + bunker eating). */
  bottomY() {
    let minY = Infinity;
    for (let t = 0; t < 3; t++) {
      for (const inv of this.byType[t].list) {
        const p = this._worldPos(inv);
        if (p.y < minY) minY = p.y;
      }
    }
    return minY === Infinity ? -Infinity : minY;
  }

  /** World positions of every live invader (for bunker-eating overlap tests). */
  livePositions() {
    const out = [];
    for (let t = 0; t < 3; t++) {
      for (const inv of this.byType[t].list) {
        const p = this._worldPos(inv);
        out.push(p);
      }
    }
    return out;
  }

  /** Bottom-most live invader per column (for bullet source selection). */
  bottomByColumn() {
    const cols = new Array(this.cols).fill(null);
    for (let t = 0; t < 3; t++) {
      for (const inv of this.byType[t].list) {
        const p = this._worldPos(inv);
        const cur = cols[inv.col];
        if (!cur || p.y < cur.y) cols[inv.col] = p;
      }
    }
    return cols;
  }

  /** Destroy all invaders (nuke). Returns count. */
  clearAll() {
    const n = this.alive;
    for (let t = 0; t < 3; t++) {
      this.byType[t].list.length = 0;
      this.byType[t].mesh.count = 0;
      this.byType[t].mesh.instanceMatrix.needsUpdate = true;
    }
    this.alive = 0;
    this._flash.clear();
    return n;
  }

  dispose() {
    for (let t = 0; t < 3; t++) {
      const bt = this.byType[t];
      this.scene.remove(bt.mesh);
      bt.mesh.dispose();
    }
  }
}
