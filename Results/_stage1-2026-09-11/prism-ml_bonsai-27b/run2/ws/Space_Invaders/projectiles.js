import { vec3, clamp } from '../shared/utils/math.js';
import { Pool } from '../shared/particle.js';

/**
 * Projectile class — pooled projectiles for player and alien fire.
 * Each projectile is a small box with emissive material for neon glow.
 */
export class Projectile {
  constructor(type, x, y, z, velocity) {
    this.type = type; // 'player' or 'alien'
    this.x = x;
    this.y = y;
    this.z = z;
    this.velocity = velocity;
    this.active = true;
    this.width = 0.15;
    this.height = 0.6;
    this.depth = 0.15;

    // Create geometry (a small box)
    const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
    const color = type === 'player' ? new THREE.Color(0x00ffff) : new THREE.Color(0xff4488);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color.clone().multiplyScalar(3.0),
      metalness: 0.5,
      roughness: 0.2,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(this.x, this.y, this.z);
  }

  update(dt) {
    if (!this.active) return;
    const vel = this.velocity * dt;
    this.x += vel.x;
    this.y += vel.y;
    this.z += vel.z;

    // Remove if off screen or too far back
    if (this.y < -2 || this.y > 10 || this.x < -5 || this.x > 14) {
      this.active = false;
    }
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}

/**
 * ProjectilePool — pooled management of projectiles.
 */
export class ProjectilePool extends Pool {
  constructor(maxSize = 100) {
    super(maxSize);
    this.maxSize = maxSize;
  }

  spawn(type, x, y, z, velocity) {
    const p = new Projectile(type, x, y, z, velocity);
    this._pool.push(p);
    return p;
  }

  update(dt) {
    for (let i = this._pool.length - 1; i >= 0; i--) {
      const p = this._pool[i];
      if (!p.active) {
        this._pool.splice(i, 1);
        continue;
      }
      p.update(dt);
    }
  }

  getActive() {
    return this._pool.filter(p => p.active);
  }

  disposeAll() {
    for (const p of this._pool) {
      p.dispose();
    }
    this._pool = [];
  }
}