import { createPlayerMesh } from '../rendering/playerMesh.js';
import { lerp, clamp } from '../../shared/math.js';
import { NEON_COLORS, PLAYER_CONSTANTS } from '../../shared/constants.js';

export class PlayerShip {
  constructor(scene, x = 0) {
    this.scene = scene;
    this.x = x;
    this.y = PLAYER_CONSTANTS.Y_POSITION;
    this.width = PLAYER_CONSTANTS.WIDTH;
    this.height = PLAYER_CONSTANTS.HEIGHT;
    
    this.velocityX = 0;
    this.maxSpeed = PLAYER_CONSTANTS.MAX_SPEED;
    this.acceleration = PLAYER_CONSTANTS.ACCELERATION;
    this.friction = PLAYER_CONSTANTS.FRICTION;
    
    this.shootCooldown = 0;
    this.invulnerableTime = 0;
    this.isInvulnerable = false;
    
    this.alive = true;
    this.blinkFrame = 0;
    this.blinkInterval = 0.1;
    
    // Create mesh
    this.mesh = createPlayerMesh();
    this.scene.add(this.mesh);
    
    // Power-up state
    this.powerUps = {
      spreadShot: false,
      shield: false,
      rapidFire: false
    };
    this.powerUpTimers = {};
  }

  update(dt, input) {
    if (!this.alive) return;

    // Handle movement input
    let moveLeft = false;
    let moveRight = false;

    if (input.keys.has('ArrowLeft') || input.keys.has('a')) {
      moveLeft = true;
    }
    if (input.keys.has('ArrowRight') || input.keys.has('d')) {
      moveRight = true;
    }

    // Gamepad support
    if (input.gamepad) {
      const axisX = input.gamepad.axes[0];
      if (axisX < -0.3) moveLeft = true;
      if (axisX > 0.3) moveRight = true;
    }

    // Apply acceleration
    if (moveLeft && !moveRight) {
      this.velocityX -= this.acceleration * dt;
    } else if (moveRight && !moveLeft) {
      this.velocityX += this.acceleration * dt;
    }

    // Apply friction
    this.velocityX *= this.friction;

    // Clamp velocity
    this.velocityX = clamp(this.velocityX, -this.maxSpeed, this.maxSpeed);

    // Update position
    this.x += this.velocityX * dt;

    // Boundary collision with elastic bounce
    const boundaryLeft = -PLAYER_CONSTANTS.BOUNDARY_X + this.width / 2;
    const boundaryRight = PLAYER_CONSTANTS.BOUNDARY_X - this.width / 2;

    if (this.x < boundaryLeft) {
      this.x = boundaryLeft;
      this.velocityX *= -0.5; // Bounce with energy loss
    } else if (this.x > boundaryRight) {
      this.x = boundaryRight;
      this.velocityX *= -0.5;
    }

    // Update mesh position
    this.mesh.position.set(this.x, this.y, 0);

    // Shoot cooldown update
    if (this.shootCooldown > 0) {
      const rapidFireMultiplier = this.powerUps.rapidFire ? 2 : 1;
      this.shootCooldown -= dt * rapidFireMultiplier;
    }

    // Invulnerability timer
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= dt;
      if (this.invulnerableTime <= 0) {
        this.isInvulnerable = false;
        this.mesh.visible = true;
      } else {
        this.handleBlink(dt);
      }
    }

    // Power-up timers
    this.updatePowerUps(dt);
  }

  handleBlink(dt) {
    this.blinkFrame += dt;
    if (this.blinkFrame >= this.blinkInterval) {
      this.blinkFrame = 0;
      this.mesh.visible = !this.mesh.visible;
    }
  }

  updatePowerUps(dt) {
    for (const [powerUp, active] of Object.entries(this.powerUps)) {
      if (!active) continue;

      const timerKey = `${powerUp}Timer`;
      if (!this.powerUpTimers[timerKey]) continue;

      this.powerUpTimers[timerKey] -= dt;
      
      if (this.powerUpTimers[timerKey] <= 0) {
        this.deactivatePowerUp(powerUp);
      }
    }
  }

  activatePowerUp(type, duration = 10) {
    switch (type) {
      case 'spreadShot':
        this.powerUps.spreadShot = true;
        this.powerUpTimers.spreadShotTimer = duration;
        break;
      case 'shield':
        this.powerUps.shield = true;
        this.powerUpTimers.shieldTimer = duration;
        break;
      case 'rapidFire':
        this.powerUps.rapidFire = true;
        this.powerUpTimers.rapidFireTimer = duration;
        break;
    }
  }

  deactivatePowerUp(type) {
    this.powerUps[type] = false;
    delete this.powerUpTimers[`${type}Timer`];
  }

  canShoot() {
    return this.shootCooldown <= 0 && this.alive;
  }

  shoot() {
    if (!this.canShoot()) return null;

    const rapidFireMultiplier = this.powerUps.rapidFire ? 0.5 : 1;
    this.shootCooldown = PLAYER_CONSTANTS.SHOOT_COOLDOWN * rapidFireMultiplier;

    // Return projectile spawn data
    return {
      x: this.x,
      y: this.y + this.height / 2,
      isPlayerProjectile: true,
      spreadShot: this.powerUps.spreadShot
    };
  }

  takeDamage() {
    if (!this.alive) return false;

    // Shield absorbs damage
    if (this.powerUps.shield) {
      this.deactivatePowerUp('shield');
      return true; // Damage absorbed, player survives
    }

    // Invulnerable frames prevent damage
    if (this.isInvulnerable) {
      return true; // Already invulnerable, no new damage
    }

    this.alive = false;
    this.mesh.visible = false;
    
    // Grant temporary invulnerability for respawn
    this.invulnerableTime = PLAYER_CONSTANTS.INVULNERABILITY_DURATION;
    this.isInvulnerable = true;
    
    return false; // Player took damage
  }

  respawn() {
    this.alive = true;
    this.x = 0;
    this.velocityX = 0;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, this.y, 0);
    
    // Reset power-ups on respawn (optional design choice)
    for (const key of Object.keys(this.powerUps)) {
      this.deactivatePowerUp(key);
    }
  }

  getHitbox() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      width: this.width,
      height: this.height
    };
  }

  getBoundingBox() {
    return {
      minX: this.x - this.width / 2,
      maxX: this.x + this.width / 2,
      minY: this.y - this.height / 2,
      maxY: this.y + this.height / 2
    };
  }

  resetPosition() {
    this.x = 0;
    this.velocityX = 0;
    this.mesh.position.set(this.x, this.y, 0);
  }

  setInvulnerable(duration) {
    this.invulnerableTime = duration;
    this.isInvulnerable = true;
    this.blinkFrame = 0;
  }

  reset() {
    this.respawn();
    this.resetPosition();
    this.shootCooldown = 0;
  }

  setWeaponType(type) {
    if (type === 'spread') {
      this.activatePowerUp('spreadShot', 15);
    }
  }

  activateShield() {
    this.activatePowerUp('shield', 15);
  }

  setFireRate(cooldown) {
    // Override shoot cooldown for rapid fire
    PLAYER_CONSTANTS.SHOOT_COOLDOWN = cooldown * 1000;
    setTimeout(() => {
      PLAYER_CONSTANTS.SHOOT_COOLDOWN = 250;
    }, 15000);
  }

  destroy() {
    this.dispose();
  }

  dispose() {
    if (this.scene && this.mesh) {
      this.scene.remove(this.mesh);
    }
    
    // Dispose materials from player mesh group
    const disposeMaterials = (group) => {
      if (group.isGroup) {
        group.children.forEach(child => {
          if (child.material) {
            child.material.dispose();
          }
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.isGroup) {
            disposeMaterials(child);
          }
        });
      } else if (group.material) {
        group.material.dispose();
      }
      if (group.geometry) {
        group.geometry.dispose();
      }
    };
    
    disposeMaterials(this.mesh);
  }

  setVFXAndAudio(vfx, audioSynth) {
    this.vfx = vfx;
    this.audioSynth = audioSynth;
  }
}
