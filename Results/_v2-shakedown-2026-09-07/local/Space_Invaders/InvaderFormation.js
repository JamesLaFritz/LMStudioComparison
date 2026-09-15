import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, randInt } from '../shared/utils/Math.js';

// Classic 2-frame invader sprites, encoded as pixel masks ('#' = solid).
const SPRITES = {
  squid: [
    '....##....',
    '...####...',
    '..######..',
    '.##.##.##.',
    '##########',
    '#.######.#',
    '#.#....#.#',
    '..#..#..#.',
  ],
  squid2: [
    '....##....',
    '...####...',
    '..######..',
    '.##.##.##.',
    '##########',
    '.#######..',
    '##.#..#.##',
    '.#.#..#.#.',
  ],
  crab: [
    '..#.....#..',
    '.#.....#..',
    '###...###..',
    '####.####..',
    '############',
    '#.######.#.',
    '#.#....#.#.',
    '...##.##...',
  ],
  crab2: [
    '..#.....#..',
    '.#.....#..',
    '###...###..',
    '####.####..',
    '############',
    '#.######.#.',
    '..#.#.#.#..',
    '.#..##..#..',
  ],
  octopus: [
    '....####....',
    '.##########.',
    '############',
    '###..##..###',
    '###..##..###',
    '...##..##...',
    '..##.##.##..',
    '##.#.##.#.##',
  ],
  octopus2: [
    '....####....',
    '.##########.',
    '############',
    '###..##..###',
    '###..##..###',
    '...##..##...',
    '..##.##.##..',
    '.###....###.',
  ],
};

const TYPES = [
  { name: 'squid',   score: 10, color: 0x00ffd0, emissive: 0x00ffd0 },
  { name: 'crab',    score: 20, color: 0xff2fd6, emissive: 0xff2fd6 },
  { name: 'octopus', score: 30, color: 0xffb300, emissive: 0xffb300 },
];

function buildSpriteGeometry(mask, width, height, depth) {
  const cols = mask[0].length;
  const rows = mask.length;
  const px = width / cols;
  const py = height / rows;
  const boxes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r][c] === '#') {
        const box = new THREE.BoxGeometry(px * 0.92, py * 0.92, depth);
        box.translate((c - (cols - 1) / 2) * px, ((rows - 1) / 2 - r) * py, 0);
        boxes.push(box);
      }
    }
  }
  const merged = mergeGeometries(boxes);
  for (const b of boxes) b.dispose();
  return merged;
}

export class InvaderFormation {
  constructor(scene, fx, opts) {
    this.scene = scene;
    this.fx = fx;
    this.opts = opts;

    this.cols = 11;
    this.rows = 5;
    this.DX = 1.55;
    this.DY = 1.35;
    this.startY = 10.5;
    this.offsetX = 0;
    this.offsetY = this.startY;
    this.dir = 1;
    this.frame = 0;
    this.stepTimer = 0;
    this.stepsThisFrame = 0;
    this.alive = this.rows * this.cols;

    // Per-invader state.
    this.invaders = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const type = r === 0 ? 0 : (r <= 2 ? 1 : 2);
        const t = TYPES[type];
        this.invaders.push({
          row: r, col: c, type,
          score: t.score,
          color: t.color,
          alive: true, dying: false, deathT: 0,
          x: 0, y: 0,
        });
      }
    }

    // Build 6 instanced meshes (3 types x 2 frames).
    this.meshes = [];
    this.geometries = [];
    this.materials = [];
    const depth = 0.5;
    for (const t of TYPES) {
      for (let f = 0; f < 2; f++) {
        const mask = f === 0 ? SPRITES[t.name] : SPRITES[t.name + '2'];
        const geo = buildSpriteGeometry(mask, 1.35, 1.1, depth);
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(t.color).multiplyScalar(0.25),
          emissive: new THREE.Color(t.emissive),
          emissiveIntensity: 2.2,
          metalness: 0.3,
          roughness: 0.5,
        });
        const mesh = new THREE.InstancedMesh(geo, mat, this.rows * this.cols);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.count = 0;
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.meshes.push(mesh);
        this.geometries.push(geo);
        this.materials.push(mat);
      }
    }

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._e = new THREE.Euler();

    this._rebuild();
  }

  _typeFrameIndex(type, frame) { return type * 2 + frame; }

  _rebuild() {
    // Lay out positions and populate the 6 instanced meshes.
    for (const inv of this.invaders) {
      inv.x = this.offsetX + (inv.col - (this.cols - 1) / 2) * this.DX;
      inv.y = this.offsetY - inv.row * this.DY;
    }
    for (let i = 0; i < this.meshes.length; i++) this.meshes[i].count = 0;
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      const idx = this._typeFrameIndex(inv.type, this.frame);
      const mesh = this.meshes[idx];
      const n = mesh.count;
      const scale = inv.dying ? Math.max(0.001, 1 - inv.deathT / 0.25) : 1;
      this._p.set(inv.x, inv.y, 0);
      this._q.setFromEuler(this._e.set(0, 0, inv.dying ? inv.deathT * 6 : 0));
      this._s.setScalar(scale);
      this._m.compose(this._p, this._q, this._s);
      mesh.setMatrixAt(n, this._m);
      mesh.count = n + 1;
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }

  get minX() {
    let m = Infinity;
    for (const inv of this.invaders) if (inv.alive) m = Math.min(m, inv.x);
    return m;
  }
  get maxX() {
    let m = -Infinity;
    for (const inv of this.invaders) if (inv.alive) m = Math.max(m, inv.x);
    return m;
  }
  get minY() {
    let m = Infinity;
    for (const inv of this.invaders) if (inv.alive) m = Math.min(m, inv.y);
    return m;
  }

  stepInterval(wave = 1) {
    const a = this.alive;
    const base = clamp(0.72 * Math.sqrt(a / 55), 0.075, 0.72);
    // Later waves march faster (plan §1.6 intervalScale).
    const scale = Math.max(0.45, 1 - 0.08 * (wave - 1));
    return base * scale;
  }

  kill(inv) {
    if (!inv.alive || inv.dying) return;
    inv.dying = true;
    inv.deathT = 0;
  }

  update(dt, wave) {
    this.stepsThisFrame = 0;
    // Advance any dying invaders; finalize deaths.
    let finalized = false;
    for (const inv of this.invaders) {
      if (inv.dying) {
        inv.deathT += dt;
        if (inv.deathT >= 0.25) {
          inv.dying = false;
          inv.alive = false;
          this.alive--;
          finalized = true;
        }
      }
    }
    if (finalized) this._rebuild();

    // Discrete step movement.
    this.stepTimer += dt;
    const interval = this.stepInterval(wave);
    while (this.stepTimer >= interval && this.alive > 0) {
      this.stepTimer -= interval;
      this._doStep(wave);
      if (this.alive === 0) break;
    }
    return this.alive;
  }

  _doStep(wave) {
    this.offsetX += this.dir * 0.85;
    this.frame ^= 1;
    // Edge test against live bounds.
    const minX = this.minX;
    const maxX = this.maxX;
    if ((this.dir > 0 && maxX > 10.4) || (this.dir < 0 && minX < -10.4)) {
      this.dir *= -1;
      this.offsetY -= 0.8;
      this.offsetX += this.dir * 0.85; // undo the overshoot
    }
    this._rebuild();
  }

  // Invasion check: any live invader bottom below the line.
  checkInvasion(line) {
    for (const inv of this.invaders) {
      if (inv.alive && inv.y - 0.7 < line) return true;
    }
    return false;
  }

  // Returns the lowest live invader in a column (for enemy fire origin).
  lowestInColumn(col) {
    let best = null;
    for (const inv of this.invaders) {
      if (inv.alive && inv.col === col && (!best || inv.y < best.y)) best = inv;
    }
    return best;
  }

  /**
   * Classic column-weighted fire: with probability `prob`, pick a random
   * column that still has a live invader and return the lowest one in it.
   * Returns null if no shot is taken (or the formation is empty).
   */
  pickFiringInvader(prob) {
    if (this.alive === 0 || Math.random() > prob) return null;
    const cols = [];
    for (const inv of this.invaders) {
      if (inv.alive && cols.indexOf(inv.col) === -1) cols.push(inv.col);
    }
    if (cols.length === 0) return null;
    return this.lowestInColumn(cols[(Math.random() * cols.length) | 0]);
  }

  /** Call `fn(inv)` for every live invader. */
  forEachAlive(fn) {
    for (const inv of this.invaders) if (inv.alive) fn(inv);
  }

  /**
   * AABB test: returns the first live invader overlapping the given box, or
   * null. Bullet half-extents (hw, hh) are added to the invader half-extents.
   */
  hitAt(x, y, hw, hh) {
    const iw = 0.675, ih = 0.55; // half-extents of a 1.35 x 1.1 invader
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      if (Math.abs(x - inv.x) < hw + iw && Math.abs(y - inv.y) < hh + ih) return inv;
    }
    return null;
  }

  reset(wave) {
    this.alive = this.rows * this.cols;
    this.frame = 0;
    this.stepTimer = 0;
    this.dir = 1;
    this.offsetX = 0;
    this.startY = Math.max(8.5, 10.5 - 0.4 * (wave - 1));
    this.offsetY = this.startY;
    for (const inv of this.invaders) {
      inv.alive = true;
      inv.dying = false;
      inv.deathT = 0;
    }
    this._rebuild();
  }

  dispose() {
    for (const m of this.meshes) this.scene.remove(m);
    for (const g of this.geometries) g.dispose();
    for (const mat of this.materials) mat.dispose();
  }
}
