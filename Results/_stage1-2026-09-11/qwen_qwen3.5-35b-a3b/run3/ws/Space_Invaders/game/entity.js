import * as THREE from 'three';
import { Vector3, lerp } from '../../../shared/utils/math.js';

/**
 * Base Entity class for all game objects
 */
export class Entity {
  constructor(position) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.position = position instanceof THREE.Vector3 ? position.clone() : new Vector3(position.x || 0, position.y || 0, position.z || 0);
    this.velocity = new Vector3(0, 0, 0);
    this.rotation = new Vector3(0, 0, 0);
    
    // Physical properties
    this.width = 1.0;
    this.height = 1.0;
    this.depth = 0.5;
    
    // State flags
    this.active = true;
    this.health = 1.0;
    this.maxHealth = 1.0;
    
    // Visual representation (optional)
    this.mesh = null;
    this.userData = {};
  }

  update(deltaTime, worldBounds) {
    if (!this.active) return;
    
    // Apply velocity
    this.position.addScaledVector(this.velocity, deltaTime);
    
    // Boundary constraints
    if (worldBounds) {
      this.position.x = Math.max(worldBounds.minX, Math.min(worldBounds.maxX, this.position.x));
      this.position.y = Math.max(worldBounds.minY, Math.min(worldBounds.maxY, this.position.y));
    }
  }

  setMesh(mesh) {
    if (this.mesh) {
      // Dispose old mesh to prevent memory leaks
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
    this.mesh = mesh;
  }

  dispose() {
    if (this.mesh) {
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) {
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach(m => m.dispose());
        } else {
          this.mesh.material.dispose();
        }
      }
      this.mesh = null;
    }
  }

  getBounds() {
    return {
      minX: this.position.x - this.width / 2,
      maxX: this.position.x + this.width / 2,
      minY: this.position.y - this.height / 2,
      maxY: this.position.y + this.height / 2,
      minZ: this.position.z - this.depth / 2,
      maxZ: this.position.z + this.depth / 2
    };
  }

  collidesWith(other) {
    const a = this.getBounds();
    const b = other.getBounds ? other.getBounds() : {
      minX: other.position.x - other.width/2,
      maxX: other.position.x + other.width/2,
      minY: other.position.y - other.height/2,
      maxY: other.position.y + other.height/2
    };
    
    const padding = 0.15; // Collision padding
    
    return a.minX + padding < b.maxX - padding &&
           a.maxX - padding > b.minX + padding &&
           a.minY + padding < b.maxY - padding &&
           a.maxY - padding > b.minY + padding;
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.active = false;
      return true; // Dead
    }
    return false; // Still alive
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  reset(position) {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.active = true;
  }
}