import * as THREE from 'three';

/**
 * Bullet - Projectile entity for player and enemy shots
 */
export class Bullet {
  constructor(config, scene) {
    this.config = config;
    this.scene = scene;
    
    // Geometry (shared for performance)
    this.geometry = new THREE.CylinderGeometry(0.3, 0.3, 4, 8);
    this.geometry.rotateX(Math.PI / 2); // Point along Y axis
    
    // Mesh
    this.mesh = null;
    
    // Physics state
    this.position = { x: 0, y: 0 };
    this.velocityY = 0;
    this.direction = 1; // 1 = up (player), -1 = down (enemy)
    
    // Hitbox dimensions
    this.width = config.bulletWidth || 4;
    this.height = config.bulletHeight || 12;
    
    // State
    this.active = false;
    this.type = 'player'; // 'player' or 'enemy'
    
    // Materials cache (created on init)
    this.playerMaterial = null;
    this.enemyMaterial = null;
  }
  
  /**
   * Initialize bullet at position with direction
   */
  init(positionX, positionY, direction, type) {
    this.active = true;
    this.position.x = positionX;
    this.position.y = positionY;
    this.direction = direction;
    this.type = type;
    
    // Set velocity based on type
    const speed = type === 'player' ? this.config.bulletSpeed : this.config.enemyBulletSpeed;
    this.velocityY = direction * speed;
    
    // Create mesh if needed
    if (!this.mesh) {
      this.createMesh(type);
      this.scene.add(this.mesh);
    } else {
      // Update material based on type
      const color = type === 'player' ? this.config.colors.bulletPlayer : this.config.colors.bulletEnemy;
      this.mesh.material.color.setHex(color);
      this.mesh.material.emissive.setHex(color);
    }
    
    // Position mesh
    this.mesh.position.set(this.position.x, this.position.y, 0);
    
    return this;
  }
  
  createMesh(type) {
    const color = type === 'player' ? this.config.colors.bulletPlayer : this.config.colors.bulletEnemy;
    
    if (type === 'player' && !this.playerMaterial) {
      this.playerMaterial = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 2.5,
        metalness: 0.3,
        roughness: 0.4
      });
    } else if (type === 'enemy' && !this.enemyMaterial) {
      this.enemyMaterial = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 2.5,
        metalness: 0.3,
        roughness: 0.4
      });
    }
    
    const material = type === 'player' ? this.playerMaterial : this.enemyMaterial;
    this.mesh = new THREE.Mesh(this.geometry, material);
  }
  
  /**
   * Update bullet position
   */
  update(deltaTime) {
    if (!this.active) return false;
    
    // Move bullet
    this.position.y += this.velocityY * deltaTime;
    
    // Update mesh position
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, 0);
    }
    
    return true;
  }
  
  /**
   * Check if bullet is out of bounds
   */
  isOutOfBounds() {
    const screenTop = -this.config.screenHeight / 2 + 50;
    const screenBottom = this.config.screenHeight / 2 - 50;
    
    // Player bullets go up (positive Y direction in our coordinate system)
    if (this.direction === 1 && this.position.y > screenTop) {
      return true;
    }
    // Enemy bullets go down
    if (this.direction === -1 && this.position.y < screenBottom) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Get hitbox for collision detection
   */
  getHitbox() {
    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;
    return {
      left: this.position.x - halfWidth,
      right: this.position.x + halfWidth,
      top: this.position.y + halfHeight,
      bottom: this.position.y - halfHeight
    };
  }
  
  /**
   * Deactivate bullet (for collision handling)
   */
  deactivate() {
    this.active = false;
    if (this.mesh && this.mesh.visible !== false) {
      this.mesh.visible = false;
    }
  }
  
  /**
   * Reset for pooling - don't dispose geometry/materials
   */
  reset() {
    this.active = false;
    this.position.x = 0;
    this.position.y = 0;
    this.velocityY = 0;
    this.direction = 1;
    this.type = 'player';
    
    if (this.mesh) {
      this.mesh.visible = false;
      this.mesh.position.set(9999, 9999, 9999); // Move off-screen
    }
  }
  
  /**
   * Cleanup - dispose resources when game ends
   */
  dispose() {
    if (this.mesh && this.mesh.parent) {
      this.scene.remove(this.mesh);
    }
    
    if (this.playerMaterial) {
      this.playerMaterial.dispose();
      this.playerMaterial = null;
    }
    
    if (this.enemyMaterial) {
      this.enemyMaterial.dispose();
      this.enemyMaterial = null;
    }
    
    // Note: geometry is shared, don't dispose it here
  }
}
