import * as THREE from 'three';
import { MeshStandardMaterial, MeshBasicMaterial } from 'three';
import { Pool } from '../../shared/utils/Pool.js';

class EnemyFormation {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    // Formation configuration
    this.rows = 5;
    this.columns = 11;
    this.alienWidth = 2.0;
    this.alienHeight = 1.5;
    this.alienDepth = 0.8;
    this.rowSpacing = 3.0;
    this.columnSpacing = 3.0;
    this.startX = -15;
    this.startY = 20;
    this.startZ = 0;

    // Movement configuration
    this.moveSpeed = 2.0;
    this.dropDistance = 10.0;
    this.moveDirection = 1;
    this.moveTimer = 0;
    this.moveInterval = 1.0;

    // Alien types with different point values and colors
    this.alienTypes = [
      { points: 30, color: 0x44ffaa },   // Row 0 - Squid (top)
      { points: 20, color: 0x88ffaa },   // Row 1 - Crab
      { points: 10, color: 0xffaa44 },   // Row 2 - Octopus
      { points: 5, color: 0xff6644 },    // Row 3 - Squid
      { points: 3, color: 0x88ff44 }     // Row 4 - Crab (bottom)
    ];

    // Create alien mesh pool using object pooling
    this.alienPool = new Pool(55);
    this.activeAliens = [];
    this.hitAliens = [];

    // Enemy projectile pool
    this.enemyBulletPool = new Pool(20);
    this.enemyProjectiles = [];

    // Initialize formation
    this.initFormation();
  }

  initFormation() {
    this.activeAliens = [];
    this.hitAliens = [];

    for (let row = 0; row < this.rows; row++) {
      const alienType = this.alienTypes[row];
      for (let col = 0; col < this.columns; col++) {
        const alien = this.createAlien(row, col, alienType);
        if (alien) {
          this.activeAliens.push(alien);
        }
      }
    }

    this.moveDirection = 1;
    this.moveTimer = 0;
  }

  createAlien(row, col, alienType) {
    const x = this.startX + col * this.columnSpacing;
    const y = this.startY - row * this.rowSpacing;
    const z = this.startZ;

    const item = this.alienPool.acquire((item) => {
      const geometry = new THREE.BoxGeometry(
        this.alienWidth,
        this.alienHeight,
        this.alienDepth
      );

      const material = new MeshStandardMaterial({
        color: alienType.color,
        emissive: alienType.color * 0.5,
        emissiveIntensity: 1.0,
        metalness: 0.7,
        roughness: 0.3
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);

      item.x = x;
      item.y = y;
      item.z = z;
      item.row = row;
      item.col = col;
      item.points = alienType.points;
      item.color = alienType.color;
      item.active = true;
      item.mesh = mesh;

      return item;
    });

    if (item) {
      this.hitAliens.push(item);
    }

    return item;
  }

  update(deltaTime, playerProjectiles, enemyProjectiles) {
    // Update movement timer
    this.moveTimer += deltaTime;

    // Move aliens horizontally at intervals
    if (this.moveTimer >= this.moveInterval) {
      this.moveAliens();
      this.moveTimer = 0;
    }

    // Check for edge collisions and reverse direction
    const maxX = this.startX + (this.columns - 1) * this.columnSpacing + this.alienWidth / 2;
    const minX = this.startX + this.alienWidth / 2;

    if ((this.moveDirection === 1 && this.hitAliens.some(a => a.x > maxX)) ||
        (this.moveDirection === -1 && this.hitAliens.some(a => a.x < minX))) {
      this.moveDirection *= -1;
      this.dropAliens();
    }

    // Update alien positions
    for (const alien of this.hitAliens) {
      if (!alien.active) continue;
      alien.mesh.position.set(alien.x, alien.y, alien.z);
    }

    // Check for enemy projectiles hitting aliens
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
      const p = enemyProjectiles[i];
      if (!p || !p.active) continue;

      let hitAlien = null;
      for (const alien of this.hitAliens) {
        if (!alien.active) continue;
        if (this.checkProjectileCollision(p, alien)) {
          hitAlien = alien;
          break;
        }
      }

      if (hitAlien) {
        this.handleAlienDeath(hitAlien);
        p.dispose();
        enemyProjectiles.splice(i, 1);
        continue;
      }
    }

    // Check for player projectiles hitting aliens
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
      const p = playerProjectiles[i];
      if (!p || !p.active) continue;

      let hitAlien = null;
      for (const alien of this.hitAliens) {
        if (!alien.active) continue;
        if (this.checkProjectileCollision(p, alien)) {
          hitAlien = alien;
          break;
        }
      }

      if (hitAlien) {
        this.handleAlienDeath(hitAlien);
        p.dispose();
        playerProjectiles.splice(i, 1);
        continue;
      }
    }

    // Check if aliens have reached the bottom
    const minY = this.startY - (this.rows - 1) * this.rowSpacing + this.alienHeight / 2;
    for (const alien of this.hitAliens) {
      if (!alien.active) continue;
      if (alien.y < minY - 5) {
        return true; // Game over
      }
    }

    return false;
  }

  moveAliens() {
    for (const alien of this.hitAliens) {
      if (!alien.active) continue;
      alien.x += this.moveSpeed * this.moveDirection;
    }
  }

  dropAliens() {
    for (const alien of this.hitAliens) {
      if (!alien.active) continue;
      alien.y -= this.dropDistance;
    }
  }

  checkProjectileCollision(projectile, target) {
    const p = projectile;
    if (!p || !p.active) return false;

    // AABB collision check
    const px = p.position.x;
    const py = p.position.y;
    const pz = p.position.z;
    const pr = 0.3; // Bullet radius for forgiving hitbox

    for (const alien of this.hitAliens) {
      if (!alien.active) continue;

      const ax = alien.x;
      const ay = alien.y;
      const az = alien.z;
      const aw = this.alienWidth / 2;
      const ah = this.alienHeight / 2;
      const ad = this.alienDepth / 2;

      // Check if bullet is within AABB bounds
      const closestX = Math.max(ax - aw, Math.min(px, ax + aw));
      const closestY = Math.max(ay - ah, Math.min(py, ay + ah));
      const closestZ = Math.max(az - ad, Math.min(pz, az + ad));

      const dx = px - closestX;
      const dy = py - closestY;
      const dz = pz - closestZ;

      if (dx * dx + dy * dy + dz * dz <= pr * pr) {
        return true;
      }
    }

    return false;
  }

  handleAlienDeath(alien) {
    // Spawn explosion particles at alien position
    const particleSystem = this.scene.game?.particleSystem || null;
    if (particleSystem) {
      particleSystem.emit('explosion', alien.x, alien.y, alien.z, 1.5);
    }

    // Screen shake based on impact velocity
    const cameraShake = this.scene.game?.cameraShake || null;
    if (cameraShake) {
      cameraShake.trigger(3.0);
    }

    // Spawn shockwave
    const shockwaveManager = this.scene.game?.shockwaveManager || null;
    if (shockwaveManager) {
      shockwaveManager.create(alien.x, alien.y, alien.z, 10, 0.6);
    }

    // Add score based on alien row
    const points = alien.points;
    this.scene.game.score += points;
    this.scene.game.updateScoreDisplay();

    // Spawn floating score text
    this.spawnFloatingText(alien.x, alien.y, `+${points}`, '#ffdd00');

    // Remove the hit alien from formation
    this.removeAlien(alien);
  }

  spawnFloatingText(x, y, text, color) {
    const scoreDisplay = this.scene.game?.scoreDisplay || null;
    if (scoreDisplay) {
      scoreDisplay.addFloatingText(x, y, text, color);
    }
  }

  removeAlien(alien) {
    alien.active = false;
    // Remove from active list
    const idx = this.activeAliens.indexOf(alien);
    if (idx !== -1) {
      this.activeAliens.splice(idx, 1);
    }
    // Return to pool for reuse
    this.alienPool.returnToPool(alien);

    // Remove from hit list
    const hitIdx = this.hitAliens.indexOf(alien);
    if (hitIdx !== -1) {
      this.hitAliens.splice(hitIdx, 1);
    }
  }

  getHitAlien(projectile) {
    for (const alien of this.hitAliens) {
      if (!alien.active) continue;
      const px = projectile.position.x;
      const py = projectile.position.y;
      const pz = projectile.position.z;
      const pr = 0.3;

      const ax = alien.x;
      const ay = alien.y;
      const az = alien.z;
      const aw = this.alienWidth / 2;
      const ah = this.alienHeight / 2;
      const ad = this.alienDepth / 2;

      const closestX = Math.max(ax - aw, Math.min(px, ax + aw));
      const closestY = Math.max(ay - ah, Math.min(py, ay + ah));
      const closestZ = Math.max(az - ad, Math.min(pz, az + ad));

      const dx = px - closestX;
      const dy = py - closestY;
      const dz = pz - closestZ;

      if (dx * dx + dy * dy + dz * dz <= pr * pr) {
        return alien;
      }
    }
    return null;
  }

  isDefeated() {
    return this.activeAliens.length === 0;
  }

  reset(waveNumber) {
    // Reset formation for new wave
    this.alienPool.clear();
    this.initFormation();
    this.enemyProjectiles = [];
  }

  dispose() {
    for (const alien of this.hitAliens) {
      if (alien.mesh) {
        alien.mesh.dispose();
      }
    }
    this.alienPool.clear();
    for (const p of this.enemyProjectiles) {
      p.dispose();
    }
  }
}

export default EnemyFormation;