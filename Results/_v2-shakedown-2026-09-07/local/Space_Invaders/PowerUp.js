import * as THREE from 'three';
import { ObjectPool } from '../shared/core/ObjectPool.js';
import { pick } from '../shared/utils/Math.js';

const TYPES = ['RAPID', 'WIDE', 'SHIELD', 'BOMB'];
const COLORS = {
  RAPID: 0xffe14d,
  WIDE: 0x4dc9ff,
  SHIELD: 0x7dff6a,
  BOMB: 0xff5c39,
};

/**
 * Falling power-up pickups. One shared octahedron geometry + one material per
 * type (instanceColor carries the per-pickup tint). Collected by AABB overlap
 * with the player; despawn below the court.
 */
export class PowerUp {
  constructor(scene, { fallSpeed = 2.2, killY = -1.5 } = {}) {
    this.scene = scene;
    this.fallSpeed = fallSpeed;
    this.killY = killY;
    this.active = [];

    this.geometry = new THREE.OctahedronGeometry(0.34);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x0a0f18,
      emissive: 0xffffff,
      emissiveIntensity: 2.4,
      metalness: 0.3,
      roughness: 0.3,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, 12);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.pool = new ObjectPool(
      () => ({ x: 0, y: 0, type: 'RAPID', spin: 0 }),
      (p) => { p.x = 0; p.y = 0; p.type = 'RAPID'; p.spin = 0; },
      12,
    );
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  spawn(x, y, type) {
    const p = this.pool.acquire();
    if (!p) return null;
    p.x = x;
    p.y = y;
    p.type = type || pick(TYPES);
    p.spin = 0;
    this.active.push(p);
    return p;
  }

  update(dt, time) {
    let n = 0;
    for (let i = 0; i < this.active.length; i++) {
      const p = this.active[i];
      p.y -= this.fallSpeed * dt;
      p.spin += dt * 3.2;
      if (p.y < this.killY) {
        this.pool.release(p);
        continue;
      }
      this._p.set(p.x, p.y, 0);
      this._q.setFromEuler(new THREE.Euler(p.spin * 0.6, p.spin, 0));
      this._s.setScalar(1);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(n, this._m);
      this._c.setHex(COLORS[p.type]);
      this.mesh.setColorAt(n, this._c);
      n++;
    }
    this.active.length = n;
    this.mesh.count = n;
    if (n > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  /** AABB test against a player box; returns the collected pickup or null. */
  testCollect(px, py, pw, ph) {
    const hw = 0.34 + pw * 0.5;
    const hh = 0.34 + ph * 0.5;
    for (let i = 0; i < this.active.length; i++) {
      const p = this.active[i];
      if (Math.abs(p.x - px) < hw && Math.abs(p.y - py) < hh) {
        // Snapshot before release: the pool's reset hook mutates p (type → 'RAPID'),
        // so the caller must read the real type/position from a copy.
        const out = { type: p.type, x: p.x, y: p.y };
        this.pool.release(p);
        this.active.splice(i, 1);
        this.mesh.count = this.active.length;
        if (this.mesh.count > 0) this.mesh.instanceMatrix.needsUpdate = true;
        return out;
      }
    }
    return null;
  }

  /** Call `fn(pickup)` for every live pickup (Game uses this for collection tests). */
  forEachActive(fn) {
    for (let i = 0; i < this.active.length; i++) fn(this.active[i]);
  }

  /** CSS color string for a pickup type (for floating text / HUD). */
  colorOf(type) {
    const hex = COLORS[type] ?? 0xffffff;
    return `#${hex.toString(16).padStart(6, '0')}`;
  }

  /** Numeric hex color for a pickup type (for particles / VFX). */
  hexOf(type) {
    return COLORS[type] ?? 0xffffff;
  }

  clear() {
    for (let i = 0; i < this.active.length; i++) this.pool.release(this.active[i]);
    this.active.length = 0;
    this.mesh.count = 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
