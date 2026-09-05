import * as THREE from 'three';
import { PLAYER_SPEED, PLAYER_MIN_X, PLAYER_MAX_X, FIRE_COOLDOWN, INVULNERABLE_DURATION, BLINK_INTERVAL } from '../utils/Constants.js';

export class Player {
  constructor() {
    this.position = new THREE.Vector3(0, -3.5, 0);
    this.velocityX = 0;
    this.targetVelocityX = 0;
    this.lives = 3;
    this.alive = true;
    this.respawnTimer = 0;
    this.invulnerable = false;
    this.blinkTimer = 0;
    this.fireCooldown = 0;
    this.canFire = true;
  }

  update(inputDir, effectiveDt) {
    if (!this.alive) {
      this.respawnTimer -= effectiveDt;
      if (this.respawnTimer <= 0) {
        this.alive = true;
        this.invulnerable = true;
        this.blinkTimer = 0;
        this.position.set(0, -3.5, 0);
      }
      return;
    }

    // Blink during invulnerability
    if (this.invulnerable) {
      this.blinkTimer += effectiveDt;
      return;
    }

    // Movement input (normalized axis from InputController)
    this.targetVelocityX = inputDir * PLAYER_SPEED;
    const accel = 12.0;
    this.velocityX += (this.targetVelocityX - this.velocityX) * Math.min(1, accel * effectiveDt);
    this.position.x += this.velocityX * effectiveDt;

    // Clamp to playfield bounds
    if (this.position.x < PLAYER_MIN_X) { this.position.x = PLAYER_MIN_X; this.velocityX = 0; }
    if (this.position.x > PLAYER_MAX_X) { this.position.x = PLAYER_MAX_X; this.velocityX = 0; }

    // Fire cooldown
    if (this.fireCooldown > 0) {
      this.fireCooldown -= effectiveDt;
    }
  }

  shoot() {
    if (!this.canFire || !this.alive || this.invulnerable || this.fireCooldown > 0) return null;
    this.fireCooldown = FIRE_COOLDOWN;
    return true;
  }

  takeDamage() {
    if (!this.alive) return false;
    this.lives--;
    this.alive = false;
    this.respawnTimer = INVULNERABLE_DURATION;
    this.invulnerable = false;
    return this.lives > 0;
  }

  respawn() {
    this.alive = true;
    this.invulnerable = true;
    this.blinkTimer = 0;
    this.position.set(0, -3.5, 0);
    this.fireCooldown = 0;
  }

  canShoot() {
    return this.alive && !this.invulnerable && this.fireCooldown <= 0;
  }

  isRespawning() {
    return !this.alive || this.invulnerable;
  }

  isInvulnerable() {
    return this.invulnerable;
  }

  reset() {
    this.position.set(0, -3.5, 0);
    this.velocityX = 0;
    this.targetVelocityX = 0;
    this.lives = 3;
    this.alive = true;
    this.respawnTimer = 0;
    this.invulnerable = false;
    this.blinkTimer = 0;
    this.fireCooldown = 0;
    this.canFire = true;
  }

  dispose() {
    // Nothing to dispose - no Three.js objects owned by Player
  }
}
