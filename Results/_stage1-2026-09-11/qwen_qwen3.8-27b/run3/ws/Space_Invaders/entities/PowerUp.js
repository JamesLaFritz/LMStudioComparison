import * as THREE from 'three';
import ObjectPool from '../../shared/core/ObjectPool.js';
import { BOUNDS, POWERUPS, COLORS } from '../config.js';

const TYPE_KEYS = Object.keys(POWERUPS.types);

/**
 * PowerUp — pooled falling power-ups. Each is a small emissive icosahedron
 * with a per-type hue. Falls under gravity; the game detects pickup and
 * applies the effect (see PowerUpSystem).
 */
export default class PowerUp {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../shared/core/MemoryRegistry.js').MemoryRegistry} registry
   */
  constructor(scene, registry) {
    this.scene = scene;
    this.registry = registry;

    const geo = new THREE.IcosahedronGeometry(0.45, 0);
    this._geo = geo;
    this._mats = {};
    for (const key of TYPE_KEYS) {
      const c = POWERUPS.types[key].color;
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(c),
        emissiveIntensity: 2.0,
        metalness: 0.3,
        roughness: 0.3,
      });
      registry.track(mat);
      this._mats[key] = mat;
    }
    registry.track(geo);

    this.pool = new ObjectPool(
      () => {
        const m = new THREE.Mesh(geo, this._mats[TYPE_KEYS[0]]);
        m.visible = false;
        m.frustumCulled = false;
        scene.add(m);
        return m;
      },
      (m) => {
        m.visible = false;
        m.position.set(0, -999, 0);
      },
      POWERUPS.poolSize
    );
  }

  /** Spawn a power-up of a random type at (x, y). */
  spawn(x, y) {
    const m = this.pool.acquire();
    const type = TYPE_KEYS[(Math.random() * TYPE_KEYS.length) | 0];
    m.material = this._mats[type];
    m.visible = true;
    m.position.set(x, y, 0);
    m.userData = { type, vy: 0, spin: Math.random() * Math.PI * 2 };
    return m;
  }

  /**
   * Advance all live power-ups.
   * @returns {Array<{mesh, type, x, y}>} live power-ups (for pickup test)
   */
  update(dt) {
    const live = [];
    for (const m of this.pool.active) {
      if (!m.visible) continue;
      const u = m.userData;
      u.vy += POWERUPS.gravity * dt;
      m.position.y += u.vy * dt;
      u.spin += dt * 3;
      m.rotation.x = u.spin;
      m.rotation.y = u.spin * 0.7;

      if (m.position.y < BOUNDS.bottom - 1) {
        this.pool.release(m);
        continue;
      }
      live.push({ mesh: m, type: u.type, x: m.position.x, y: m.position.y });
    }
    return live;
  }

  /** Release a specific power-up (after pickup). */
  release(m) {
    this.pool.release(m);
  }

  activeCount() {
    let n = 0;
    for (const m of this.pool.active) if (m.visible) n++;
    return n;
  }

  releaseAll() {
    this.pool.releaseAll();
  }

  dispose() {
    for (const m of this.pool.free) this.scene.remove(m);
    for (const m of this.pool.active) this.scene.remove(m);
    // geo / mats disposed via registry
  }
}
