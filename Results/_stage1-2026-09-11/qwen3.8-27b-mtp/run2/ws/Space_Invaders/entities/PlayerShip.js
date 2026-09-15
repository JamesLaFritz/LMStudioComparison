import * as THREE from 'three';
import { clamp } from '../../shared/math/MathUtils.js';
import CONFIG from '../config.js';

/**
 * Player cannon. Acceleration-based motion with exponential (frame-rate
 * independent) damping, edge-triggered fire with cooldown, and timed power-up
 * states (rapid / spread / shield). Bullets are owned by the game's pool; this
 * class only reports shots via onFire(shots[]).
 */
export class PlayerShip {
  constructor(scene, onFire) {
    this.onFire = onFire;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x14324a, metalness: 0.85, roughness: 0.3, emissive: 0x0a2436, emissiveIntensity: 0.5 });
    const neonMat = new THREE.MeshStandardMaterial({ color: 0x0b1e2c, metalness: 0.4, roughness: 0.4, emissive: 0x00f5ff, emissiveIntensity: 2.6 });

    this.root = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.34, 0.9), bodyMat);
    hull.position.y = -0.08;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.72, 0.7), neonMat);
    spine.position.set(0, 0.34, 0);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.4), neonMat);
    tip.position.set(0, 0.62, 0);
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.7), bodyMat);
    wingL.position.x = -0.95;
    const wingR = wingL.clone();
    wingR.position.x = 0.95;
    this.root.add(hull, spine, tip, wingL, wingR);

    // Shield bubble (power-up) — hidden until active.
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0x0a2e3c, metalness: 0.1, roughness: 0.2, transparent: true, opacity: 0.28, emissive: 0x7dff6a, emissiveIntensity: 1.6, depthWrite: false }),
    );
    this.shieldMesh.visible = false;
    this.root.add(this.shieldMesh);

    scene.add(this.root);

    this.x = 0;
    this.vx = 0;
    this.tilt = 0;
    this.fireCooldown = 0;
    this.alive = true;
    this.invincible = CONFIG.player.invulnAfterHit;
    this.powerRapid = 0;
    this.powerSpread = 0;
    this.shieldHits = 0;

    // Disposables owned by this entity.
    const geos = [hull.geometry, spine.geometry, tip.geometry, wingL.geometry, this.shieldMesh.geometry];
    this._disposeList = [...geos, bodyMat, neonMat, this.shieldMesh.material];
  }

  dispose() { for (const d of this._disposeList) d.dispose(); }

  /** Reset for a new life / wave. */
  reset() {
    this.x = 0;
    this.vx = 0;
    this.tilt = 0;
    this.fireCooldown = 0;
    this.alive = true;
    this.invincible = CONFIG.player.invulnAfterHit;
    this.powerRapid = 0;
    this.powerSpread = 0;
    this.shieldHits = 0;
    this.shieldMesh.visible = false;
    this.root.position.set(0, CONFIG.arena.playerY, 0);
    this.root.scale.setScalar(1);
    this.root.rotation.set(0, 0, 0);
  }

  /** Called by the game when a bomb kills the ship. */
  die() {
    this.alive = false;
    this.powerRapid = 0;
    this.powerSpread = 0;
    this.shieldHits = 0;
    this.shieldMesh.visible = false;
    this.root.visible = false;
  }

  applyPowerUp(kind) {
    if (kind === 'rapid') this.powerRapid = CONFIG.powerups.duration;
    else if (kind === 'spread') this.powerSpread = CONFIG.powerups.duration;
    else if (kind === 'shield') this.shieldHits = CONFIG.powerups.shieldHits;
  }

  get fireInterval() { return this.powerRapid > 0 ? CONFIG.player.fireCooldown * CONFIG.powerups.rapidCooldownScale : CONFIG.player.fireCooldown; }

  update(dt, axisX) {
    if (!this.alive) return;

    // Acceleration + exponential damping: frame-rate independent.
    const accel = CONFIG.player.accel * clamp(axisX, -1, 1);
    this.vx += accel * dt;
    this.vx *= Math.exp(-CONFIG.player.friction * dt);
    if (Math.abs(this.vx) < 1e-4 && axisX === 0) this.vx = 0;

    const prevX = this.x;
    this.x += this.vx * dt;
    const minX = -CONFIG.arena.halfWidth + 1.2;
    const maxX = CONFIG.arena.halfWidth - 1.2;
    if (this.x < minX) { this.x = minX; this.vx = Math.max(0, this.vx); }
    if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx); }

    // Tilt into the motion for a sense of weight.
    const targetTilt = clamp((this.x - prevX) * 1.4, -0.35, 0.35);
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 12);

    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.powerRapid > 0) this.powerRapid -= dt;
    if (this.powerSpread > 0) this.powerSpread -= dt;
    if (this.invincible > 0) this.invincible -= dt;

    // Present.
    const bob = Math.sin(performance.now() * 0.004) * 0.03;
    this.root.position.set(this.x, CONFIG.arena.playerY + bob, 0);
    this.root.rotation.z = -this.tilt;
    if (this.invincible > 0 && this.alive) {
      const blink = Math.sin(performance.now() * 0.02) > 0 ? 1 : 0.35;
      this.root.scale.setScalar(blink);
    } else {
      this.root.scale.setScalar(1);
    }
    if (this.shieldHits > 0) {
      const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.04;
      this.shieldMesh.visible = true;
      this.shieldMesh.scale.setScalar(pulse);
    } else {
      this.shieldMesh.visible = false;
    }
  }

  /** Edge-triggered fire (called by the game when input.edge.fire). Returns shot descriptors. */
  tryFire() {
    if (!this.alive || this.fireCooldown > 0) return [];
    this.fireCooldown = this.fireInterval;
    const y = CONFIG.arena.playerY + 0.55;
    const speed = CONFIG.player.bulletSpeed;
    if (this.powerSpread > 0) {
      const a = CONFIG.player.spreadAngle ?? 0.42;
      return [
        { x: this.x, y, vx: -Math.sin(a) * speed * 0.55, vy: Math.cos(a) * speed },
        { x: this.x, y, vx: 0, vy: speed },
        { x: this.x, y, vx: Math.sin(a) * speed * 0.55, vy: Math.cos(a) * speed },
      ];
    }
    return [{ x: this.x, y, vx: 0, vy: speed }];
  }

  get hitRadius() { return CONFIG.player.radius; }
  get position() { return this.root.position; }
}
