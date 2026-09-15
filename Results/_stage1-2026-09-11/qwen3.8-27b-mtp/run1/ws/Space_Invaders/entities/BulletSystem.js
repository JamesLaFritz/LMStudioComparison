// Space_Invaders/entities/BulletSystem.js
// Pooled player + alien bullets. Classic caps: 1 live player bullet, 3 live alien
// bullets. All collision tests are swept segment–circle in XZ (tunneling-proof at
// any frame rate). Zero allocation in the hot path — fixed pools, scratch vectors.

import * as THREE from 'three';
import ObjectPool from '../../shared/core/ObjectPool.js';
import { clamp } from '../../shared/utils/math.js';
import { BULLET, PLAYER, WORLD } from '../config.js';

const _v = new THREE.Vector3();

function makeBulletMesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.visible = false;
  return m;
}

export class BulletSystem {
  /**
   * @param scene THREE.Scene
   * @param mats { playerGeo, playerMat, alienGeo, alienMat } — shared geometry/materials
   */
  constructor(scene, mats) {
    this.scene = scene;

    // Player bullets: single live instance (classic rule). `seg` is a persistent
    // struct so erosion queries never allocate.
    this.playerBullet = {
      mesh: makeBulletMesh(mats.playerGeo, mats.playerMat),
      active: false, x: 0, z: 0, px: 0, pz: 0, seg: { ax: 0, az: 0, bx: 0, bz: 0 },
    };
    scene.add(this.playerBullet.mesh);

    // Alien bullets: pool of 3 (classic cap).
    this.alienPool = new ObjectPool(() => ({
      mesh: makeBulletMesh(mats.alienGeo, mats.alienMat),
      active: false, x: 0, z: 0, px: 0, pz: 0, speed: BULLET.ALIEN_BASE_SPEED,
      trail: null, // motion-trail slot id — released via onBulletReleased when the bullet dies
    }), BULLET.ALIEN_MAX_LIVE);
    for (const b of this.alienPool.items) scene.add(b.mesh);

    // Scratch for swept tests.
    this._seg = { x: 0, z: 0 };
  }

  get playerLiveCount() { return this.playerBullet.active ? 1 : 0; }
  get alienLiveCount() { let n = 0; for (const b of this.alienPool.items) if (b.active) n++; return n; }

  /** Fire the single player bullet from the ship. Returns true when fired. */
  firePlayer(x, z) {
    const p = this.playerBullet;
    if (p.active) return false; // classic: max one live
    p.active = true;
    p.x = x; p.z = z; p.px = x; p.pz = z;
    p.mesh.visible = true;
    p.mesh.position.set(x, PLAYER.Y, z);
    return true;
  }

  /** Fire one alien bullet from (x,z) toward the player line. Returns the bullet or null when capped. */
  fireAlien(x, z, speed) {
    const b = this.alienPool.acquire();
    if (!b) return null; // cap reached — classic behavior: shot is lost
    b.x = x; b.z = z; b.px = x; b.pz = z; b.speed = speed;
    b.mesh.visible = true;
    b.mesh.position.set(x, 1.0, z);
    return b;
  }

  /** Advance all bullets one sim step. Returns { player: bullet|null, aliens: [bullet] }. */
  update(dt) {
    const p = this.playerBullet;
    if (p.active) {
      p.px = p.x; p.pz = p.z;
      p.z -= BULLET.PLAYER_SPEED * dt;
      p.mesh.position.set(p.x, PLAYER.Y, p.z);
      // Persistent segment for erosion queries — no allocation per call.
      p.seg.ax = p.px; p.seg.az = p.pz; p.seg.bx = p.x; p.seg.bz = p.z;
      if (p.z < WORLD.Z_FAR_LIMIT) this._killPlayerBullet();
    }

    const live = [];
    for (const b of this.alienPool.items) {
      if (!b.active) continue;
      b.px = b.x; b.pz = b.z;
      b.z += b.speed * dt;
      b.mesh.position.set(b.x, 1.0, b.z);
      if (b.z > WORLD.Z_NEAR_LIMIT) { this._releaseAlien(b); continue; }
      live.push(b);
    }
    return { player: p.active ? p : null, aliens: live };
  }

  _killPlayerBullet() {
    const p = this.playerBullet;
    p.active = false;
    p.mesh.visible = false;
  }

  /** Public kill — the orchestrator calls this when a hit is resolved. */
  killPlayerBullet() { this._killPlayerBullet(); }

  /** Swept test: did the player bullet's segment pass within radius of (tx,tz)? */
  playerHitTest(tx, tz, radius) {
    const p = this.playerBullet;
    if (!p.active) return false;
    return segmentCircleXZ(p.px, p.pz, p.x, p.z, tx, tz, radius);
  }

  /** Swept test against one alien bullet. */
  alienHitTest(b, tx, tz, radius) {
    if (!b.active) return false;
    return segmentCircleXZ(b.px, b.pz, b.x, b.z, tx, tz, radius);
  }

  /** Persistent player-bullet segment (updated each step in update()). Null when inactive. */
  playerSegment() {
    const p = this.playerBullet;
    return p.active ? p.seg : null;
  }

  /** Persistent alien-bullet segment for bunker erosion — no allocation per call. */
  alienSegment(b) {
    if (!b.active || !b.seg) return null;
    b.seg.ax = b.px; b.seg.az = b.pz; b.seg.bx = b.x; b.seg.bz = b.z;
    return b.seg;
  }

  /** Internal release: notify the trail owner (if wired), then pool the bullet. */
  _releaseAlien(b) {
    if (this.onBulletReleased) this.onBulletReleased(b);
    this.alienPool.release(b);
  }

  clearAll() {
    if (this.playerBullet.active) this._killPlayerBullet();
    this.alienPool.releaseAll();
  }

  dispose() {
    this.scene.remove(this.playerBullet.mesh);
    for (const b of this.alienPool.items) this.scene.remove(b.mesh);
  }
}

// Local swept test (XZ only — bullets travel along Z, targets are point-circles).
function segmentCircleXZ(ax, az, bx, bz, px, pz, radius) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? (apx * abx + apz * abz) / len2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + abx * t - px;
  const cz = az + abz * t - pz;
  return cx * cx + cz * cz <= radius * radius;
}
