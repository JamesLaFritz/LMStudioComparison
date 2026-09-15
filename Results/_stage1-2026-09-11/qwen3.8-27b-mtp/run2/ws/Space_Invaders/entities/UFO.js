import * as THREE from 'three';
import { ufoHull, hullBounds } from '../../shared/procedural/GeometryFactory.js';
import { CONFIG } from '../config.js';

/**
 * The mystery ship. Crosses the top of the arena on a timer; high-value target.
 * Pooled: one instance at a time (Game owns the pool).
 */
export class UFO {
  constructor() {
    const geo = ufoHull();
    this.materials = [
      new THREE.MeshStandardMaterial({ color: 0x2a0f3d, metalness: 0.75, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0xff4fd8, emissive: 0xff2fb8, emissiveIntensity: 1.6, metalness: 0.4, roughness: 0.35 }),
    ];
    this.mesh = new THREE.Mesh(geo, this.materials);

    // Scale the saucer hull to arena-appropriate width (~3.4 units).
    const b = hullBounds('ufo');
    const s = 3.4 / Math.max(b.w, 0.001);
    this.mesh.scale.setScalar(s);

    this.root = this.mesh;
    this.mesh.visible = false;
    this.active = false;
    this.speed = CONFIG.ufo.speed;
    this.dir = 1;
    this.baseY = 5.0;
    this.wobbleT = 0;
    this.scoreValue = 0;
  }

  spawn(wave) {
    this.dir = Math.random() < 0.5 ? -1 : 1;
    const startX = this.dir === 1 ? -(CONFIG.arena.halfWidth + 0.6) : (CONFIG.arena.halfWidth + 0.6);
    this.mesh.position.set(startX, this.baseY, 0);
    this.speed = CONFIG.ufo.speed * (1 + (wave - 1) * 0.08);
    this.wobbleT = Math.random() * 6;
    // Classic: UFO score is a random bonus in [pointsLow, pointsHigh].
    this.scoreValue = Math.round(CONFIG.ufo.pointsLow + Math.random() * (CONFIG.ufo.pointsHigh - CONFIG.ufo.pointsLow));
    this.active = true;
    this.mesh.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    this.wobbleT += dt * 3.0;
    const p = this.mesh.position;
    p.x += this.dir * this.speed * dt;
    p.y = this.baseY + Math.sin(this.wobbleT) * 0.12;
    if (p.x < -(CONFIG.arena.halfWidth + 1.4) || p.x > CONFIG.arena.halfWidth + 1.4) {
      this.active = false;
      this.mesh.visible = false; // Game releases it back to the pool
    }
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false; // recycled by the post-pass sweepInactive()
  }

  get position() { return this.mesh.position; }
}
