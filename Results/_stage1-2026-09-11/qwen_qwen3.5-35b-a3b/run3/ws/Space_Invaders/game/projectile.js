import * as THREE from 'three';
import { Vector3 } from '../../shared/utils/math.js';

export class Projectile extends THREE.Mesh {
  constructor(position, velocity, isPlayerBullet = true) {
    super();
    
    this.isPlayerBullet = isPlayerBullet;
    this.velocity = velocity.clone();
    this.damage = 1;
    this.lifetime = isPlayerBullet ? 60 : 90; // frames remaining
    this.active = false;
    this.id = Math.random().toString(36).substr(2, 9);
    
    // Create geometry (small capsule for retro look)
    const geometry = new THREE.CapsuleGeometry(0.15, 0.4, 4, 8);
    geometry.rotateZ(Math.PI / 2);
    
    // Material with emissive glow for bloom effect
    this.material = new THREE.MeshStandardMaterial({
      color: isPlayerBullet ? 0x00ffff : 0xff4400,
      emissive: isPlayerBullet ? 0x0088ff : 0xff2200,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.7
    });
    
    this.geometry = geometry;
    this.position.copy(position);
    
    // Add userData for collision detection
    this.userData = {
      width: 0.3,
      height: 0.4,
      type: 'projectile',
      ownerId: isPlayerBullet ? 'player' : 'enemy'
    };
  }

  update(deltaTime) {
    if (!this.active) return;
    
    // Apply velocity
    this.position.addScaledVector(this.velocity, deltaTime);
    
    // Update lifetime
    this.lifetime -= deltaTime * 60;
    if (this.lifetime <= 0) {
      this.deactivate();
    }
    
    // Boundary check - remove if out of bounds
    if (Math.abs(this.position.x) > 10 || Math.abs(this.position.y) > 8) {
      this.deactivate();
    }
  }

  deactivate() {
    this.active = false;
    this.visible = false;
  }

  activate(position, velocity) {
    this.active = true;
    this.visible = true;
    this.position.copy(position);
    this.velocity.copy(velocity);
    this.lifetime = this.isPlayerBullet ? 60 : 90;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}