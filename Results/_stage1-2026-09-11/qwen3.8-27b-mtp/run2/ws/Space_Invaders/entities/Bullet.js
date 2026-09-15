import * as THREE from 'three';

/** Projectile kinds — shared by the player-shot and bomb pools. */
export const BULLET_PLAYER = 'player';
export const BULLET_BOMB = 'bomb';

/**
 * A single pooled projectile (player shot or invader bomb). Geometry and
 * material are injected so every bullet in a pool shares one GPU pair —
 * dozens of live shots cost two draw-call materials total, not fifty.
 */
export class Bullet {
  constructor(geometry, material) {
    this.mesh = new THREE.Mesh(geometry, material);
    this.root = this.mesh; // uniform pooled-entity contract: .root is the scene node
    this.mesh.visible = false;
    this.active = false;
    this.vx = 0;
    this.vy = 0;
    this.kind = BULLET_PLAYER;
  }

  spawn(x, y, vy, kind = BULLET_PLAYER, vx = 0) {
    const m = this.mesh;
    m.visible = true;
    m.position.set(x, y, 0);
    this.active = true;
    this.vx = vx;
    this.vy = vy;
    this.kind = kind;
    return this;
  }

  update(dt) {
    if (!this.active) return;
    const p = this.mesh.position;
    p.x += this.vx * dt;
    p.y += this.vy * dt;
    // Cull far off-screen so dead bullets recycle back to the pool.
    if (p.y < -6.5 || p.y > 7.8 || p.x < -12 || p.x > 12) this.deactivate();
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
  }

  get position() { return this.mesh.position; }
}
