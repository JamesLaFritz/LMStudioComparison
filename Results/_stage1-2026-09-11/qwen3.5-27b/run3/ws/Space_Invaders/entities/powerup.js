import { NEON_COLORS } from '../../shared/constants.js';

/**
 * PowerUp class - dropped by UFO, provides temporary abilities
 */
export class PowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 1.5;
    this.height = 1.0;
    
    // Type: 'spread', 'shield', or 'rapidfire'
    const types = ['spread', 'shield', 'rapidfire'];
    this.type = types[Math.floor(Math.random() * types.length)];
    
    this.active = true;
    this.fallSpeed = 1.5;
    
    // Visual properties
    this.color = this.getColorForType();
    this.mesh = null;
    this.blinkTimer = 0;
    this.blinkVisible = true;
  }

  getColorForType() {
    switch (this.type) {
      case 'spread': return NEON_COLORS.PURPLE;
      case 'shield': return NEON_COLORS.CYAN;
      case 'rapidfire': return NEON_COLORS.ORANGE;
      default: return NEON_COLORS.WHITE;
    }
  }

  createMesh() {
    const geometry = new THREE.BoxGeometry(this.width, this.height, 0.5);
    const material = new THREE.MeshStandardMaterial({
      color: 0x111111,
      emissive: this.color,
      emissiveIntensity: 2.0,
      metalness: 0.5,
      roughness: 0.3
    });

    this.mesh = new THREE.Mesh(geometry, material);
    return this.mesh;
  }

  update(dt) {
    if (!this.active) return;

    // Fall downward
    this.y -= this.fallSpeed * dt;

    // Blink effect
    this.blinkTimer += dt;
    if (this.blinkTimer > 0.15) {
      this.blinkTimer = 0;
      this.blinkVisible = !this.blinkVisible;
    }

    // Update mesh position and visibility
    if (this.mesh) {
      this.mesh.position.set(this.x, this.y, 0);
      this.mesh.visible = this.blinkVisible && this.active;
    }
  }

  checkCollision(playerX, playerWidth) {
    if (!this.active) return false;

    const halfPlayer = playerWidth / 2;
    const halfPowerUp = this.width / 2;

    // Simple AABB collision on X axis (Y is fixed for player)
    const playerLeft = playerX - halfPlayer;
    const playerRight = playerX + halfPlayer;
    const powerUpLeft = this.x - halfPowerUp;
    const powerUpRight = this.x + halfPowerUp;

    // Check if player is at the right Y level to collect
    const collectionYThreshold = 2.0;
    
    if (this.y < collectionYThreshold && 
        !(playerRight < powerUpLeft || playerLeft > powerUpRight)) {
      this.active = false;
      return true;
    }

    return false;
  }

  isOffScreen() {
    return this.y < -15;
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}

/**
 * PowerUpManager - handles spawning and pooling power-ups
 */
export class PowerUpManager {
  constructor(scene, camera, vfxSystems, audioSynth, maxPowerUps = 5) {
    this.scene = scene;
    this.camera = camera;
    this.vfx = vfxSystems;
    this.audio = audioSynth;
    this.maxPowerUps = maxPowerUps;
    this.powerUps = [];
    this.pool = [];

    // Pre-create meshes for pool
    for (let i = 0; i < maxPowerUps; i++) {
      const geometry = new THREE.BoxGeometry(1.5, 1.0, 0.5);
      const material = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: NEON_COLORS.WHITE,
        emissiveIntensity: 2.0,
        metalness: 0.5,
        roughness: 0.3
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.scene.add(mesh);
      
      this.pool.push({
        mesh: mesh,
        geometry: geometry,
        material: material
      });
    }
  }

  spawn(x, y) {
    // Check if we have capacity
    if (this.powerUps.length >= this.maxPowerUps) {
      return null;
    }

    let powerUpData = null;
    
    if (this.pool.length > 0) {
      powerUpData = this.pool.pop();
    } else {
      // Emergency: create new mesh
      const geometry = new THREE.BoxGeometry(1.5, 1.0, 0.5);
      const material = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: NEON_COLORS.WHITE,
        emissiveIntensity: 2.0
      });
      const mesh = new THREE.Mesh(geometry, material);
      this.scene.add(mesh);
      powerUpData = { mesh, geometry, material };
    }

    const powerUp = new PowerUp(x, y);
    powerUp.mesh = powerUpData.mesh;
    powerUp.mesh.material.emissive.setHex(powerUp.color);
    powerUp.mesh.position.set(x, y, 0);
    powerUp.mesh.visible = true;

    this.powerUps.push({ powerUp, data: powerUpData });
    
    return powerUp.type; // Return type for audio feedback
  }

  update(dt) {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const item = this.powerUps[i];
      const pu = item.powerUp;

      pu.update(dt);

      // Remove if off screen
      if (pu.isOffScreen()) {
        this.recycle(i, item.data);
      }
    }
  }

  checkCollisions(playerX, playerWidth) {
    for (const item of this.powerUps) {
      const pu = item.powerUp;
      
      if (pu.checkCollision(playerX, playerWidth)) {
        // Power-up collected - remove it
        const index = this.powerUps.indexOf(item);
        if (index >= 0) {
          this.recycle(index, item.data);
          return pu.type;
        }
      }
    }
    
    return null;
  }

  recycle(index, data) {
    // Hide mesh and return to pool
    data.mesh.visible = false;
    data.mesh.position.set(9999, 9999, 0);
    this.pool.push(data);
    
    // Remove from active list
    this.powerUps.splice(index, 1);
  }

  clearAll() {
    while (this.powerUps.length > 0) {
      const item = this.powerUps.pop();
      this.recycle(this.powerUps.length, item.data);
    }
  }

  dispose() {
    // Dispose all pooled meshes
    for (const data of this.pool) {
      if (data.geometry) data.geometry.dispose();
      if (data.material) data.material.dispose();
    }
    
    // Dispose any remaining active power-ups
    for (const item of this.powerUps) {
      if (item.data.geometry) item.data.geometry.dispose();
      if (item.data.material) item.data.material.dispose();
    }

    this.pool = [];
    this.powerUps = [];
  }
}