import * as THREE from 'three';
import ObjectPool from '../../shared/core/ObjectPool.js';
import { BOUNDS, INVADER_BULLETS, COLORS } from '../config.js';

/**
 * Pooled invader bullets. Three behaviors:
 *   straight — constant downward velocity
 *   zigzag   — straight path + sinusoidal lateral offset
 *   seeker   — velocity steers toward the player (bounded turn rate)
 *
 * One shared geometry + material; instances are plain Meshes toggled by
 * visibility. Each live bullet owns a motion trail (attached on spawn,
 * detached on release) via the shared MotionTrailPool.
 */
export default class InvaderBullet {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../shared/core/MemoryRegistry.js').MemoryRegistry} registry
   * @param {import('../../shared/vfx/MotionTrailPool.js').MotionTrailPool} [trailPool]
   */
  constructor(scene, registry, trailPool = null) {
    this.scene = scene;
    this.registry = registry;
    this.trailPool = trailPool;

    const geo = new THREE.CapsuleGeometry(INVADER_BULLETS.radius, 0.55, 4, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(COLORS.invaderBullet),
      emissiveIntensity: 2.4,
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
      INVADER_BULLETS.poolSize
    );
  }

  /**
   * Spawn a bullet.
   * @param {number} x
   * @param {number} y
   * @param {number} speed downward speed (u/s)
   * @param {'straight'|'zigzag'|'seeker'} behavior
   */
  spawn(x, y, speed, behavior = 'straight') {
    const m = this.pool.acquire();
    m.visible = true;
    m.position.set(x, y, 0);
    m.userData.bullet = {
      speed,
      behavior,
      phase: Math.random() * Math.PI * 2,
      baseX: x,
      vx: 0,
      vy: -speed,
    };
    if (this.trailPool) this.trailPool.attach(m, { length: 5, width: 0.22, color: COLORS.invaderBullet });
    return m;
  }

  /**
   * Advance all live bullets.
   * @param {number} dt
   * @param {number} playerX for seeker steering
   * @returns {THREE.Mesh[]} live bullets (for collision)
   */
  update(dt, playerX) {
    const live = [];
    for (const m of this.pool.active) {
      if (!m.visible) continue;
      const b = m.userData.bullet;
      if (!b) { this._release(m); continue; }

      if (b.behavior === 'seeker') {
        // Steer velocity toward the player with a bounded turn rate.
        const desired = Math.atan2(playerX - m.position.x, -1); // angle from -Y axis
        const cur = Math.atan2(b.vx, -b.vy);
        const maxTurn = INVADER_BULLETS.seekerTurnRate * dt;
        let diff = desired - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
        const na = cur + turn;
        b.vx = Math.sin(na) * b.speed;
        b.vy = -Math.cos(na) * b.speed;
      }

      // Record the pre-move position for swept collision (anti-tunneling).
      m.prevX = m.position.x;
      m.prevY = m.position.y;

      m.position.x += b.vx * dt;
      m.position.y += b.vy * dt;

      if (b.behavior === 'zigzag') {
        b.phase += dt * 10;
        m.position.x = b.baseX + Math.sin(b.phase) * 0.6;
      }

      if (m.position.y < BOUNDS.bottom - 1 || m.position.x < BOUNDS.left - 2 || m.position.x > BOUNDS.right + 2) {
        this._release(m);
        continue;
      }
      live.push(m);
    }
    return live;
  }

  _release(m) {
    if (this.trailPool) this.trailPool.detach(m);
    this.pool.release(m);
  }

  /** Release a specific bullet (detach its trail first). Public API, matches PlayerBullet. */
  releaseBullet(m) {
    this._release(m);
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
