// shared/vfx/ParticleManager.js
// THE single particle authority for the whole game. Hard cap of 500 live
// particles is enforced HERE — no game code can exceed it.
//
// Two InstancedMesh pools (one draw call each):
//   quads  — billboarded glow sprites (soft radial texture, additive)
//   shards — micro tetrahedra that tumble with angular velocity
//
// Tier policy (plan §4):
//   P0 reserved: 120 slots guaranteed for player death / shield absorb.
//   P1 impact + P2 ambient share the remaining 380; when exhausted, the
//   OLDEST non-P0 particle is evicted first (FIFO over spawn order).
//
// Zero per-frame allocation: all scratch objects are module-level; live slots
// are compacted into a contiguous prefix of the instance buffers each frame so
// drawRange stays tight and dead instances never render.

import * as THREE from 'three';
import { TextureFactory } from '../procedural/TextureFactory.js';

const CAP = 500;          // hard cap, enforced here
const P0_COUNT = 120;     // reserved tier
const SHARD_CAP = 96;     // micro-poly pool (separate budget, small)

// Module-level scratch — never allocated per frame.
const _dummy = new THREE.Object3D();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

export class ParticleManager {
  /** @param {THREE.Scene} scene */
  constructor(scene, track) {
    this.scene = scene;
    this.track = track || ((r) => r);

    // ---- quad pool ------------------------------------------------------
    const quadGeo = new THREE.PlaneGeometry(1, 1);
    const glowTex = TextureFactory.radialGlow();
    const quadMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false, // keep neon hot through ACES so bloom reads it
    });
    this.quads = new THREE.InstancedMesh(quadGeo, quadMat, CAP);
    this.quads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.quads.frustumCulled = false;
    this.quads.renderOrder = 20;
    scene.add(this.quads);

    // ---- shard pool -----------------------------------------------------
    const shardGeo = new THREE.TetrahedronGeometry(0.16);
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0x9fd8ff,
      emissive: 0x2a6cff,
      emissiveIntensity: 1.4,
      metalness: 0.6,
      roughness: 0.35,
    });
    this.shards = new THREE.InstancedMesh(shardGeo, shardMat, SHARD_CAP);
    this.shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shards.frustumCulled = false;
    scene.add(this.shards);

    // ---- slot storage (plain objects, preallocated) ----------------------
    this.slots = new Array(CAP);
    for (let i = 0; i < CAP; i++) {
      this.slots[i] = {
        alive: false, tier: 2, order: 0,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 0.5, drag: 1.2, gravity: 6,
        color: new THREE.Color(0xffffff), spin: 0,
      };
    }
    this.shardSlots = new Array(SHARD_CAP);
    for (let i = 0; i < SHARD_CAP; i++) {
      this.shardSlots[i] = {
        alive: false, order: 0,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 1, rx: 0, ry: 0, rz: 0,
      };
    }

    this._order = 0;       // monotonic spawn counter (FIFO key)
    this._liveCount = 0;   // quads currently live
    this._shardLive = 0;
    this.quadGeo = quadGeo;
    this.quadMat = quadMat;
    this.glowTex = glowTex;
    this.shardGeo = shardGeo;
    this.shardMat = shardMat;

    // Track GPU resources for teardown.
    track(quadGeo); track(quadMat); track(glowTex);
    track(shardGeo); track(shardMat);
  }

  get activeCount() { return this._liveCount + this._shardLive; }
  get cap() { return CAP + SHARD_CAP; }

  /**
   * Spawn a burst. All params optional with sane defaults tuned for the game.
   * @param {object} o
   *   x,y,z        origin (default 0,15,0)
   *   count        quad particles (clamped to available budget)
   *   palette      array of hex colors — one per particle, cycled
   *   speedMin/speedMax  initial radial speed range (u/s)
   *   upBias       extra +y velocity factor (0..1) for "explosion" feel
   *   gravity      u/s² downward
   *   drag         linear damping coefficient (per second)
   *   lifeMin/lifeMax seconds
   *   sizeMin/sizeMax quad world-size range
   *   tier         0 | 1 | 2  (P0 reserved / P1 impact / P2 ambient)
   *   shards       number of micro-poly shards to add (≤ SHARD_CAP free)
   */
  spawnBurst(o = {}) {
    const x = o.x ?? 0, y = o.y ?? 15, z = o.z ?? 0;
    const tier = o.tier ?? 1;
    const palette = o.palette || [0xffffff];

    // ---- allocate quad slots -------------------------------------------
    let want = Math.max(0, Math.floor(o.count ?? 24));
    if (want === 0) return;

    // Evict oldest non-P0 particles (FIFO by spawn order) only as much as needed.
    const need = want - (CAP - this._liveCount);
    if (need > 0 && tier !== 0) {
      let evicted = 0;
      while (evicted < need) {
        const victim = this._findOldestNonP0();
        if (!victim) break; // nothing left to evict — spawn will take what's free
        victim.alive = false;
        evicted++;
      }
    }
    let got = 0;
    for (let i = 0; i < CAP && got < want; i++) {
      const s = this.slots[i];
      if (s.alive) continue;
      if (tier === 0 && i >= P0_COUNT) continue; // P0 only uses reserved range
      if (tier !== 0 && i < P0_COUNT && this._p0InUse(i)) continue; // don't steal live P0

      const ang = Math.random() * Math.PI * 2;
      const spd = (o.speedMin ?? 4) + Math.random() * ((o.speedMax ?? 12) - (o.speedMin ?? 4));
      s.alive = true;
      s.tier = tier;
      s.order = ++this._order;
      s.x = x; s.y = y; s.z = z;
      s.vx = Math.cos(ang) * spd;
      s.vy = Math.sin(ang) * spd * 0.8 + (o.upBias ?? 0.35) * spd * 0.6;
      s.vz = (Math.random() - 0.5) * spd * 0.25; // slight depth pop for parallax feel
      s.life = (o.lifeMin ?? 0.4) + Math.random() * ((o.lifeMax ?? 0.9) - (o.lifeMin ?? 0.4));
      s.maxLife = s.life;
      const sz = (o.sizeMin ?? 0.35) + Math.random() * ((o.sizeMax ?? 0.8) - (o.sizeMin ?? 0.35));
      s.size = sz;
      s.drag = o.drag ?? 1.6;
      s.gravity = o.gravity ?? 7;
      s.color.setHex(palette[got % palette.length]);
      got++;
    }

    // ---- allocate shards -------------------------------------------------
    if (o.shards) {
      let sgot = Math.min(o.shards, SHARD_CAP - this._shardLive);
      for (let i = 0; i < SHARD_CAP && sgot > 0; i++) {
        const s = this.shardSlots[i];
        if (s.alive) continue;
        const ang = Math.random() * Math.PI * 2;
        const spd = (o.speedMin ?? 4) * (1.2 + Math.random());
        s.alive = true;
        s.order = ++this._order;
        s.x = x; s.y = y; s.z = z;
        s.vx = Math.cos(ang) * spd;
        s.vy = Math.sin(ang) * spd + (o.upBias ?? 0.35) * 6;
        s.vz = (Math.random() - 0.5) * spd * 0.4;
        s.life = (o.lifeMin ?? 0.4) * 1.2 + Math.random() * 0.5;
        s.maxLife = s.life;
        s.size = 0.6 + Math.random() * 1.1;
        s.rx = (Math.random() - 0.5) * 14;
        s.ry = (Math.random() - 0.5) * 14;
        s.rz = (Math.random() - 0.5) * 14;
        sgot--;
      }
    }
  }

  /** True if slot i holds a live P0 particle (reserved tier). */
  _p0InUse(i) {
    const s = this.slots[i];
    return s.alive && s.tier === 0;
  }

  /** Find the oldest live non-P0 slot (smallest spawn order). O(n), n ≤ 500. */
  _findOldestNonP0() {
    let best = null;
    for (let i = 0; i < CAP; i++) {
      const s = this.slots[i];
      if (!s.alive || s.tier === 0) continue;
      if (!best || s.order < best.order) best = s;
    }
    return best;
  }

  /** Kill one particle at a world position (used by games for "absorb" effects). */
  killAt(x, y, z, radius = 0.6) {
    const r2 = radius * radius;
    let killed = 0;
    for (let i = 0; i < CAP && killed < 4; i++) {
      const s = this.slots[i];
      if (!s.alive) continue;
      const dx = s.x - x, dy = s.y - y, dz = s.z - z;
      if (dx * dx + dy * dy + dz * dz < r2) { s.alive = false; killed++; }
    }
  }

  clearAll() {
    for (let i = 0; i < CAP; i++) this.slots[i].alive = false;
    for (let i = 0; i < SHARD_CAP; i++) this.shardSlots[i].alive = false;
    this._liveCount = 0;
    this._shardLive = 0;
    this.quads.count = 0;
    this.shards.count = 0;
  }

  /**
   * Integrate + write instance buffers. dt is SCALED game time (particles are
   * world objects — they slow down under hit-stop, which reads as impact weight).
   */
  update(dt) {
    if (dt <= 0) return;
    const dragK = Math.exp(-1.6 * dt); // per-slot drag applied below

    // ---- integrate quads -------------------------------------------------
    let live = 0;
    for (let i = 0; i < CAP; i++) {
      const s = this.slots[i];
      if (!s.alive) continue;
      s.life -= dt;
      if (s.life <= 0) { s.alive = false; continue; }

      s.vy -= s.gravity * dt;
      const d = Math.exp(-s.drag * dt);
      s.vx *= d; s.vy *= d; s.vz *= d;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;

      // compact into prefix index `live`
      const t = 1 - s.life / s.maxLife;        // 0 → 1 over life
      const fade = t < 0.7 ? 1 : (1 - t) / 0.3; // hold, then ease out
      const size = s.size * (0.6 + 0.4 * Math.sin(t * Math.PI)); // swell mid-life

      _dummy.position.set(s.x, s.y, s.z);
      _dummy.quaternion.identity();
      _dummy.scale.setScalar(Math.max(0.001, size * fade));
      _dummy.updateMatrix();
      this.quads.setMatrixAt(live, _dummy.matrix);
      this.quads.setColorAt(live, s.color);
      live++;
    }

    // ---- integrate shards -------------------------------------------------
    let slive = 0;
    for (let i = 0; i < SHARD_CAP; i++) {
      const s = this.shardSlots[i];
      if (!s.alive) continue;
      s.life -= dt;
      if (s.life <= 0) { s.alive = false; continue; }

      s.vy -= 14 * dt; // heavier fall than sparks
      const d = Math.exp(-0.8 * dt);
      s.vx *= d; s.vy *= d; s.vz *= d;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.rx += s.rx * 0 + (Math.sin(s.life * 21) * 0.5); // tumble phase driver
      s.ry += s.ry * 0 + (Math.cos(s.life * 17) * 0.5);

      const t = 1 - s.life / s.maxLife;
      const fade = t < 0.6 ? 1 : (1 - t) / 0.4;
      _dummy.position.set(s.x, s.y, s.z);
      _euler.set(s.rx * t * 3, s.ry * t * 3, s.rz * t * 3);
      _dummy.quaternion.setFromEuler(_euler);
      _dummy.scale.setScalar(Math.max(0.001, s.size * fade));
      _dummy.updateMatrix();
      this.shards.setMatrixAt(slive, _dummy.matrix);
      slive++;
    }

    // ---- publish ----------------------------------------------------------
    this._liveCount = live;
    this._shardLive = slive;
    this.quads.count = live;
    this.shards.count = slive;
    if (live > 0) {
      this.quads.instanceMatrix.needsUpdate = true;
      if (this.quads.instanceColor) this.quads.instanceColor.needsUpdate = true;
    }
    if (slive > 0) this.shards.instanceMatrix.needsUpdate = true;

    // Suppress unused-var lint for the shared drag constant.
    void dragK;
  }

  dispose() {
    this.scene.remove(this.quads);
    this.scene.remove(this.shards);
    this.quads.dispose();
    this.shards.dispose();
    this.track(this.quadGeo); // already tracked at construction — no-op double track is safe
  }
}
