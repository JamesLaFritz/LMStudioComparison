import * as THREE from 'three';

export class Projectile {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.velocity = new THREE.Vector3();
    this.isPlayerProjectile = true;
    this.active = false;
    this.color = new THREE.Color(0x00ff88);
    this.bbox = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  init(position, velocity, color, isPlayerProjectile) {
    if (!this.mesh) {
      const geometry = new THREE.BoxGeometry(0.12, 0.5, 0.12);
      const material = new THREE.MeshStandardMaterial({
        color: color || 0x00ff88,
        emissive: color || 0x00ff88,
        emissiveIntensity: 2.0,
        roughness: 0.3,
        metalness: 0.7,
      });
      this.mesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.mesh);
    }

    this.mesh.position.copy(position);
    this.velocity.copy(velocity);
    this.color.set(color || (isPlayerProjectile ? 0x00ff88 : 0xff4444));
    if (this.mesh.material) {
      this.mesh.material.emissive.set(this.color);
      this.mesh.material.color.set(this.color);
    }
    this.isPlayerProjectous = isPlayerProjectile;
    this.active = true;
    this.mesh.visible = true;

    // Update bounding box
    const halfExtents = new THREE.Vector3(0.06, 0.25, 0.06);
    this.bbox.minX = position.x - halfExtents.x;
    this.bbox.maxX = position.x + halfExtents.x;
    this.bbox.minY = position.y - halfExtents.y;
    this.bbox.maxY = position.y + halfExtents.y;

    return this;
  }

  update(deltaTime) {
    if (!this.active || !this.mesh) return;

    // Move along velocity
    const moveX = this.velocity.x * deltaTime;
    const moveY = this.velocity.y * deltaTime;

    this.mesh.position.x += moveX;
    this.mesh.position.y += moveY;

    // Update bounding box for collision detection
    this.bbox.minX = this.mesh.position.x - 0.06;
    this.bbox.maxX = this.mesh.position.x + 0.06;
    this.bbox.minY = this.mesh.position.y - 0.25;
    this.bbox.maxY = this.mesh.position.y + 0.25;

    // Deactivate if out of bounds
    const BOUNDS_Y_MAX = 18;
    const BOUNDS_Y_MIN = -6;
    const BOUNDS_X_RANGE = 14;
    if (this.mesh.position.y > BOUNDS_Y_MAX || this.mesh.position.y < BOUNDS_Y_MIN ||
        Math.abs(this.mesh.position.x) > BOUNDS_X_RANGE) {
      this.deactivate();
    }
  }

  isActive() {
    return this.active;
  }

  deactivate() {
    if (this.mesh) {
      this.mesh.visible = false;
    }
    this.active = false;
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      if (this.mesh.geometry) {
        this.mesh.geometry.dispose();
      }
      if (this.mesh.material) {
        this.mesh.material.dispose();
      }
      this.mesh = null;
    }
  }

  getMesh() {
    return this.mesh;
  }
}
