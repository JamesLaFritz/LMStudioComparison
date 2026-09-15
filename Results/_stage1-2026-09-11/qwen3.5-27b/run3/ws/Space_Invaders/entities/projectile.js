import { NEON_COLORS, PROJECTILE_CONSTANTS } from '../../shared/constants.js';
import { clamp } from '../../shared/math.js';

export class ProjectilePool {
  constructor(scene, maxPlayerProjectiles = 50, maxEnemyBombs = 30) {
    this.scene = scene;
    this.playerProjectiles = [];
    this.enemyBombs = [];
    this.pool = [];
    
    const MAX_PROJECTILES = maxPlayerProjectiles + maxEnemyBombs;
    const GEOMETRY_SIZE = PROJECTILE_CONSTANTS.GEOMETRY_SIZE || { width: 0.5, height: 2, depth: 0.5 };
    
    // Pre-create geometry and material (reused for all projectiles)
    const geometry = new THREE.BoxGeometry(GEOMETRY_SIZE.width, GEOMETRY_SIZE.height, GEOMETRY_SIZE.depth);
    
    // Player projectile material (cyan glow)
    this.playerMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      emissive: NEON_COLORS.CYAN,
      emissiveIntensity: 2.0,
      metalness: 0.5,
      roughness: 0.3
    });
    
    // Enemy bomb material (red glow)
    this.bombMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      emissive: NEON_COLORS.RED,
      emissiveIntensity: 2.0,
      metalness: 0.5,
      roughness: 0.3
    });
    
    // Pre-allocate all projectiles
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const mesh = new THREE.Mesh(geometry, null); // Material assigned on spawn
      this.pool.push({
        id: i,
        mesh: mesh,
        active: false,
        type: null, // 'player' or 'enemy'
        position: new THREE.Vector3(),
        velocityY: 0,
        hitbox: { x: 0, y: 0, width: GEOMETRY_SIZE.width, height: GEOMETRY_SIZE.height }
      });
    }
    
    this.geometry = geometry; // Keep reference for disposal later
  }

  spawnPlayerProjectile(x, y) {
    const projectile = this._getFromPool();
    if (!projectile) return null;
    
    projectile.type = 'player';
    projectile.mesh.material = this.playerMaterial;
    projectile.position.set(x, y, 0);
    projectile.velocityY = PROJECTILE_CONSTANTS.PLAYER_SPEED;
    projectile.hitbox.x = x - PROJECTILE_CONSTANTS.GEOMETRY_SIZE.width / 2;
    projectile.hitbox.y = y;
    
    projectile.mesh.position.copy(projectile.position);
    projectile.active = true;
    this.active.push(projectile);
    
    if (!this.scene) {
      // Scene might not be set yet, defer add
      projectile.deferredAdd = true;
    } else {
      this.scene.add(projectile.mesh);
    }
    
    return projectile;
  }

  spawnEnemyBomb(x, y) {
    const projectile = this._getFromPool();
    if (!projectile) return null;
    
    projectile.type = 'enemy';
    projectile.mesh.material = this.bombMaterial;
    projectile.position.set(x, y, 0);
    projectile.velocityY = -PROJECTILE_CONSTANTS.ENEMY_SPEED;
    projectile.hitbox.x = x - PROJECTILE_CONSTANTS.GEOMETRY_SIZE.width / 2;
    projectile.hitbox.y = y;
    
    projectile.mesh.position.copy(projectile.position);
    projectile.active = true;
    this.active.push(projectile);
    
    if (!this.scene) {
      projectile.deferredAdd = true;
    } else {
      this.scene.add(projectile.mesh);
    }
    
    return projectile;
  }

  _getFromPool() {
    // First try the pool
    if (this.pool.length > 0) {
      return this.pool.shift();
    }
    
    // If pool empty, recycle oldest inactive projectile from active array
    // This is a last resort - should not happen with proper cleanup
    const oldestIndex = this.active.findIndex(p => 
      p.type === 'player' && p.position.y > 15 ||
      p.type === 'enemy' && p.position.y < -10
    );
    
    if (oldestIndex !== -1) {
      const recycled = this.active.splice(oldestIndex, 1)[0];
      this._removeFromScene(recycled);
      return recycled;
    }
    
    return null; // Pool exhausted
  }

  update(dt, boundaryTop, boundaryBottom) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      
      // Move projectile
      p.position.y += p.velocityY * dt * 60; // Normalize to ~60fps
      
      // Update mesh position
      p.mesh.position.copy(p.position);
      
      // Update hitbox
      p.hitbox.y = p.position.y;
      
      // Check bounds and recycle
      if (p.type === 'player' && p.position.y > boundaryTop) {
        this._recycle(i);
        continue;
      }
      
      if (p.type === 'enemy' && p.position.y < boundaryBottom) {
        this._recycle(i);
        continue;
      }
    }
  }

  _recycle(index) {
    const projectile = this.active.splice(index, 1)[0];
    this._removeFromScene(projectile);
    
    projectile.active = false;
    projectile.type = null;
    projectile.mesh.visible = false;
    this.pool.push(projectile);
  }

  _removeFromScene(projectile) {
    if (this.scene && projectile.mesh.parent) {
      this.scene.remove(projectile.mesh);
    }
  }

  getActive() {
    return this.active;
  }

  clearAll() {
    // Recycle all active projectiles back to pool
    while (this.active.length > 0) {
      const p = this.active.pop();
      this._removeFromScene(p);
      p.active = false;
      p.type = null;
      p.mesh.visible = false;
      this.pool.push(p);
    }
  }

  dispose() {
    // Remove all meshes from scene
    const allProjectiles = [...this.active, ...this.pool];
    for (const proj of allProjectiles) {
      if (this.scene && proj.mesh.parent) {
        this.scene.remove(proj.mesh);
      }
    }
    
    // Dispose geometry and materials
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    
    if (this.playerMaterial) {
      this.playerMaterial.dispose();
      this.playerMaterial = null;
    }
    
    if (this.bombMaterial) {
      this.bombMaterial.dispose();
      this.bombMaterial = null;
    }
    
    this.pool = [];
    this.active = [];
  }

  setScene(scene) {
    this.scene = scene;
    
    // Add any deferred projectiles to scene
    for (const proj of [...this.active, ...this.pool]) {
      if (proj.deferredAdd && proj.active) {
        scene.add(proj.mesh);
        proj.deferredAdd = false;
      }
    }
  }
}
