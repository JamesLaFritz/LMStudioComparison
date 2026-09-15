import * as THREE from 'three';
import { createPlayerShipGeometry } from '../../shared/procedural/GeometryGenerator.js';
import { Vector2 } from '../../shared/physics/Vector2.js';

export class PlayerShip {
  constructor(config, scene) {
    this.config = config;
    this.scene = scene;
    
    // Position and dimensions
    this.position = new Vector2(0, -config.screenHeight / 2 + config.playerYPosition);
    this.width = config.playerWidth;
    this.height = config.playerHeight;
    
    // Movement state
    this.velocity = new Vector2(0, 0);
    this.speed = config.playerSpeed;
    
    // Shooting state
    this.fireCooldown = 0;
    this.canFire = true;
    
    // Health and shields
    this.health = 3;
    this.maxHealth = 3;
    this.shieldActive = false;
    this.shieldCharge = 1.0;
    
    // Mesh setup
    this.mesh = new THREE.Group();
    this._createVisuals();
    scene.add(this.mesh);
    
    // Animation state
    this.animationTime = 0;
  }
  
  _createVisuals() {
    const config = this.config;
    
    // Main ship body using procedural geometry
    const geometry = createPlayerShipGeometry(32, 24);
    const material = new THREE.MeshStandardMaterial({
      color: config.colors.player,
      emissive: config.colors.player,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.3,
      flatShading: true
    });
    
    this.bodyMesh = new THREE.Mesh(geometry, material);
    this.bodyMesh.castShadow = true;
    this.mesh.add(this.bodyMesh);
    
    // Engine glow effect (bottom of ship)
    const engineGeometry = new THREE.SphereGeometry(4, 8, 8);
    const engineMaterial = new THREE.MeshStandardMaterial({
      color: config.colors.player,
      emissive: config.colors.player,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.9
    });
    
    this.engineGlow = new THREE.Mesh(engineGeometry, engineMaterial);
    this.engineGlow.position.y = -14;
    this.mesh.add(this.engineGlow);
    
    // Shield ring (visible when active)
    const shieldGeometry = new THREE.TorusGeometry(20, 2, 8, 32);
    const shieldMaterial = new THREE.MeshStandardMaterial({
      color: config.colors.player,
      emissive: config.colors.player,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0, // Hidden by default
      side: THREE.DoubleSide
    });
    
    this.shieldRing = new THREE.Mesh(shieldGeometry, shieldMaterial);
    this.shieldRing.rotation.x = Math.PI / 2;
    this.mesh.add(this.shieldRing);
    
    // Update position in world space
    this.updateWorldPosition();
  }
  
  update(deltaTime, input) {
    // Horizontal movement from input
    const moveInput = input.getAxis('horizontal');
    this.velocity.x = moveInput * this.speed;
    
    // Apply velocity
    this.position.x += this.velocity.x * deltaTime;
    
    // Clamp to screen bounds
    const halfWidth = this.config.screenWidth / 2 - this.width / 2;
    this.position.x = Math.max(-halfWidth, Math.min(halfWidth, this.position.x));
    
    // Update fire cooldown
    if (this.fireCooldown > 0) {
      this.fireCooldown -= deltaTime;
      this.canFire = this.fireCooldown <= 0;
    }
    
    // Animate engine glow pulse
    this.animationTime += deltaTime * 5;
    const pulseScale = 1 + Math.sin(this.animationTime) * 0.2;
    this.engineGlow.scale.setScalar(pulseScale);
    
    // Update shield ring rotation and visibility
    if (this.shieldActive) {
      this.shieldRing.rotation.z += deltaTime * 3;
      this.shieldRing.material.opacity = Math.min(1, this.shieldCharge * 0.6);
    } else {
      this.shieldRing.material.opacity = 0;
    }
    
    // Update world position
    this.updateWorldPosition();
  }
  
  updateWorldPosition() {
    this.mesh.position.set(this.position.x, this.position.y, 0);
  }
  
  tryFire(projectileManager) {
    if (!this.canFire) return null;
    
    // Create player bullet at ship position
    const bullet = projectileManager.spawnPlayerBullet(
      this.position.x,
      this.position.y + 16
    );
    
    if (bullet) {
      this.fireCooldown = this.config.fireCooldown;
      this.canFire = false;
      
      // Small recoil effect
      this.mesh.position.z += 2;
    }
    
    return bullet;
  }
  
  takeDamage(amount, vfxManager) {
    this.health -= amount;
    
    if (this.shieldActive && this.shieldCharge > 0.3) {
      // Shield absorbs damage
      this.shieldCharge -= amount * 0.5;
      if (this.shieldCharge <= 0) {
        this.shieldActive = false;
        this.health -= amount; // Take remaining damage
      } else {
        return true; // Damage blocked by shield
      }
    }
    
    // Visual feedback for taking damage
    vfxManager.triggerHitStop(6);
    vfxManager.addCameraShake(10, 0.15);
    
    // Flash red on hit
    this.bodyMesh.material.emissiveIntensity = 3;
    setTimeout(() => {
      if (this.bodyMesh) {
        this.bodyMesh.material.emissiveIntensity = 0.8;
      }
    }, 100);
    
    return false; // Damage taken
  }
  
  activateShield() {
    this.shieldActive = true;
    this.shieldCharge = 1.0;
  }
  
  isAlive() {
    return this.health > 0;
  }
  
  getBounds() {
    return {
      left: this.position.x - this.width / 2,
      right: this.position.x + this.width / 2,
      top: this.position.y + this.height / 2,
      bottom: this.position.y - this.height / 2
    };
  }
  
  dispose() {
    // Remove from scene
    if (this.mesh.parent) {
      this.scene.remove(this.mesh);
    }
    
    // Dispose geometries and materials
    this.bodyMesh.geometry.dispose();
    this.bodyMesh.material.dispose();
    
    this.engineGlow.geometry.dispose();
    this.engineGlow.material.dispose();
    
    this.shieldRing.geometry.dispose();
    this.shieldRing.material.dispose();
  }
}
