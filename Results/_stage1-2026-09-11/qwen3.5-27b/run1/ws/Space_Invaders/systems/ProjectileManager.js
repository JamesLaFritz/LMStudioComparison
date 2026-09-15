import * as THREE from 'three';
import { ObjectPool } from '../../shared/memory/ObjectPool.js';
import { CONFIG } from '../config.js';

/**
 * Bullet class - represents a single projectile
 */
class Bullet {
  constructor(pool) {
    this.pool = pool;
    
    // Mesh properties
    this.mesh = null;
    this.geometry = new THREE.CylinderGeometry(0.3, 0.3, 4, 8);
    this.geometry.rotateX(Math.PI / 2); // Point upward
    
    // Physics state
    this.position = { x: 0, y: 0 };
    this.velocityY = 0;
    this.direction = 1; // 1 = up (player), -1 = down (enemy)
    
    // Hitbox for collision
    this.hitbox = { left: 0, right: 0, top: 0, bottom: 0 };
    
    // State
    this.active = false;
    this.type = 'player'; // 'player' or 'enemy'
    
    // Trail data reference (for MotionTrails)
    this.trailId = null;
  }
  
  init(positionX, positionY, direction, type, color) {
    this.active = true;
    this.position.x = positionX;
    this.position.y = positionY;
    this.direction = direction;
    this.type = type;
    
    // Set velocity based on direction
    const speed = type === 'player' ? CONFIG.bulletSpeed : CONFIG.enemyBulletSpeed;
    this.velocityY = direction * speed;
    
    // Update hitbox
    this.updateHitbox();
    
    return this;
  }
  
  updateHitbox() {
    const halfWidth = 1.5;
    const halfHeight = 2;
    this.hitbox.left = this.position.x - halfWidth;
    this.hitbox.right = this.position.x + halfWidth;
    this.hitbox.top = this.position.y + halfHeight;
    this.hitbox.bottom = this.position.y - halfHeight;
  }
  
  update(deltaTime) {
    if (!this.active) return false;
    
    // Move bullet
    this.position.y += this.velocityY * deltaTime;
    this.updateHitbox();
    
    // Update mesh position
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, 0);
    }
    
    return true;
  }
  
  createMesh(color) {
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 2.5,
      metalness: 0.3,
      roughness: 0.4
    });
    
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.position.set(this.position.x, this.position.y, 0);
    
    return this.mesh;
  }
  
  disposeMesh() {
    if (this.mesh) {
      // Don't dispose geometry/material here - they're shared
      this.mesh = null;
    }
  }
  
  reset() {
    this.active = false;
    this.position.x = 0;
    this.position.y = 0;
    this.velocityY = 0;
    this.direction = 1;
    this.type = 'player';
    this.trailId = null;
    this.disposeMesh();
  }
}

/**
 * ProjectileManager - Handles all bullets (player and enemy) with object pooling
 */
export class ProjectileManager {
  constructor(config, scene, gameRef) {
    this.config = config;
    this.scene = scene;
    this.gameRef = gameRef;
    
    // Player bullet pool (max 30 active at once)
    this.playerBulletPool = new ObjectPool(() => new Bullet(this), 30);
    
    // Enemy bullet pool (max 100 active - invaders can fire frequently)
    this.enemyBulletPool = new ObjectPool(() => new Bullet(this), 100);
    
    // Active projectiles
    this.playerBullets = [];
    this.enemyBullets = [];
    
    // Bounds for cleanup
    this.bounds = {
      top: -config.screenHeight / 2 + 50,
      bottom: config.screenHeight / 2 - 50
    };
  }

  /**
   * Spawn a player bullet at the given position
   */
  spawnPlayerBullet(x, y) {
    const bullet = this.playerBulletPool.acquire();
    bullet.init(x, y, 1, 'player', this.config.colors.bulletPlayer);
    
    // Create mesh if not exists
    if (!bullet.mesh) {
      bullet.createMesh(this.config.colors.bulletPlayer);
      this.scene.add(bullet.mesh);
    }
    
    this.playerBullets.push(bullet);
    return bullet;
  }

  /**
   * Spawn an enemy bullet at the given position
   */
  spawnEnemyBullet(x, y) {
    const bullet = this.enemyBulletPool.acquire();
    bullet.init(x, y, -1, 'enemy', this.config.colors.bulletEnemy);
    
    // Create mesh if not exists
    if (!bullet.mesh) {
      bullet.createMesh(this.config.colors.bulletEnemy);
      this.scene.add(bullet.mesh);
    }
    
    this.enemyBullets.push(bullet);
    return bullet;
  }

  /**
   * Update all projectiles and remove out-of-bounds ones
   */
  update(deltaTime) {
    this.updateBulletGroup(this.playerBullets, this.playerBulletPool);
    this.updateBulletGroup(this.enemyBullets, this.enemyBulletPool);
  }

  /**
   * Update a group of bullets (player or enemy)
   */
  updateBulletGroup(bullets, pool) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      
      // Move the bullet
      bullet.update(deltaTime);
      
      // Check if out of bounds
      if (this.isOutOfBounds(bullet)) {
        this.removeBullet(bullets, i, pool);
      }
    }
  }

  /**
   * Check if a bullet is outside the playable area
   */
  isOutOfBounds(bullet) {
    // Player bullets go up (positive Y), enemy bullets go down (negative Y)
    if (bullet.type === 'player') {
      return bullet.position.y > this.bounds.top;
    } else {
      return bullet.position.y < this.bounds.bottom;
    }
  }

  /**
   * Remove a bullet from the array and return it to pool
   */
  removeBullet(bullets, index, pool) {
    const bullet = bullets.splice(index, 1)[0];
    if (bullet.mesh && bullet.mesh.parent) {
      this.scene.remove(bullet.mesh);
    }
    pool.release(bullet);
  }

  /**
   * Remove a specific bullet (used for collisions)
   */
  removePlayerBullet(bullet) {
    const index = this.playerBullets.indexOf(bullet);
    if (index !== -1) {
      this.removeBullet(this.playerBullets, index, this.playerBulletPool);
      return true;
    }
    return false;
  }

  removeEnemyBullet(bullet) {
    const index = this.enemyBullets.indexOf(bullet);
    if (index !== -1) {
      this.removeBullet(this.enemyBullets, index, this.enemyBulletPool);
      return true;
    }
    return false;
  }

  /**
   * Get all player bullets for collision checking
   */
  getPlayerBullets() {
    return this.playerBullets;
  }

  /**
   * Get all enemy bullets for collision checking
   */
  getEnemyBullets() {
    return this.enemyBullets;
  }

  /**
   * Clear all projectiles (used on game over / level reset)
   */
  clearAll() {
    // Return all player bullets to pool
    while (this.playerBullets.length > 0) {
      const bullet = this.playerBullets.pop();
      if (bullet.mesh && bullet.mesh.parent) {
        this.scene.remove(bullet.mesh);
      }
      this.playerBulletPool.release(bullet);
    }
    
    // Return all enemy bullets to pool
    while (this.enemyBullets.length > 0) {
      const bullet = this.enemyBullets.pop();
      if (bullet.mesh && bullet.mesh.parent) {
        this.scene.remove(bullet.mesh);
      }
      this.enemyBulletPool.release(bullet);
    }
  }

  /**
   * Get count of active projectiles (for debugging)
   */
  getActiveCount() {
    return {
      player: this.playerBullets.length,
      enemy: this.enemyBullets.length,
      total: this.playerBullets.length + this.enemyBullets.length
    };
  }
}

export { Bullet };
