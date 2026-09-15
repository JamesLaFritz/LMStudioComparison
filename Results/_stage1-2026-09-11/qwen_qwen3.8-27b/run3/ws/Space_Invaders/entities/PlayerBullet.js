import * as THREE from 'three';
import ObjectPool from '../../shared/core/ObjectPool.js';
import { BOUNDS, PLAYER, COLORS } from '../config.js';

/**
 * Pooled player bullets. One shared geometry + material; instances are plain
 * Meshes toggled by visibility. Each live bullet owns a motion trail
 * (attached on spawn, detached on release) via the shared MotionTrailPool.
 */
export default class PlayerBullet {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../shared/core/MemoryRegistry.js').MemoryRegistry} registry
   * @param {import('../../shared/vfx/MotionTrailPool.js').MotionTrailPool} [trailPool]
   */
  constructor(scene, registry, trailPool = null) {
    this.scene = scene;
    this.registry = registry;
    this.trailPool = trailPool;

    const geo = new THREE.CapsuleGeometry(PLAYER.bulletRadius, 0.5, 4, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(COLORS.playerBullet),
      emissiveIntensity: 2.2,
      metalness: 0.2,
      roughness: 0.3,
    });
    registry.track(geo);
    registry.track(mat);

    this.pool = new ObjectPool(
      () => {
        const m = new THREE.Mesh(geo, mat);
        m.visible = false;
        m.frustumCulled = false;
        scene.add(m);
        return m;
      },
      (m) => {
        m.visible = false;
        m.position.set(0, -999, 0);
      },
      PLAYER.bulletPoolSize
    );
  }

  /** Fire a bullet at (x, y). Returns the mesh. */
  fire(x, y) {
    const m = this.pool.acquire();
    m.visible = true;
    m.position.set(x, y, 0);
    m.rotation.set(0, 0, 0);
    if (this.trailPool) this.trailPool.attach(m, { length: 6, width: 0.2, color: COLORS.playerBullet });
    return m;
  }

  /** Release a specific bullet (detach its trail first). */
  releaseBullet(m) {
    if (this.trailPool) this.trailPool.detach(m);
    this.pool.release(m);
  }

  /** Advance all live bullets. Returns the list of live meshes (for collision). */
  update(dt) {
    const live = [];
    for (const m of this.pool.active) {
      if (!m.visible) continue;
      // Record the pre-move position so the game can run a swept (segment)
      // collision test — a fast bullet must not tunnel through a thin target.
      m.prevX = m.position.x;
      m.prevY = m.position.y;
      m.position.y += PLAYER.bulletSpeed * dt;
      if (m.position.y > BOUNDS.top + 2) {
        this.releaseBullet(m);
        continue;
      }
      live.push(m);
    }
    return live;
  }

  activeCount() {
    let n = 0;
    for (const m of this.pool.active) if (m.visible) n++;
    return n;
  }

  releaseAll() {
    for (const m of this.pool.active) if (this.trailPool) this.trailPool.detach(m);
    this.pool.releaseAll();
  }

  dispose() {
    for (const m of this.pool.free) this.scene.remove(m);
    for (const m of this.pool.active) this.scene.remove(m);
    // geo / mat disposed via registry
  }
}
