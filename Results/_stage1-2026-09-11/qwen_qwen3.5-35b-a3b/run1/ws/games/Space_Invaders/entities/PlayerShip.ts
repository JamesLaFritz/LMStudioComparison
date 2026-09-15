import * as THREE from 'three';
import { ObjectPool } from '../../../shared/core/ObjectPool.js';
import { Projectile } from './Projectile.js';
import { NeonMaterials } from '../../../shared/graphics/NeonMaterials.js';

export class PlayerShip {
  private _mesh: THREE.Mesh;
  private position: THREE.Vector3 = new THREE.Vector3();
  private velocity: number = 0;
  private maxSpeed: number;
  private shootCooldown: number = 0;
  private shootDelay: number;
  private isShielded: boolean = false;
  private shieldTimer: number = 0;
  private shieldMesh: THREE.Mesh | null = null;

  constructor(config: { x: number; y: number; z: number; maxSpeed: number; shootDelay: number }) {
    this.position.set(config.x, config.y, config.z);
    this.maxSpeed = config.maxSpeed;
    this.shootDelay = config.shootDelay;

    // Create player ship geometry (retro-futuristic triangle shape)
    const geometry = new THREE.ConeGeometry(0.8, 2.5, 4);
    geometry.rotateX(Math.PI / 2);
    geometry.rotateY(Math.PI / 4);

    this._mesh = new THREE.Mesh(geometry, NeonMaterials.createPlayerMaterial());
    this._mesh.position.copy(this.position);
    this._mesh.castShadow = true;
    this._mesh.receiveShadow = true;

    // Add engine glow effect
    const engineLight = new THREE.PointLight(0x00ffff, 1, 5);
    engineLight.position.set(0, -1, 0.5);
    this._mesh.add(engineLight);
  }

  get mesh(): THREE.Mesh { return this._mesh; }

  update(deltaTime: number, inputX: number, worldBounds: { minX: number; maxX: number }): void {
    // Movement with clamping
    this.velocity = inputX * this.maxSpeed;
    const newX = this.position.x + this.velocity * deltaTime;
    
    if (newX >= worldBounds.minX && newX <= worldBounds.maxX) {
      this.position.x = newX;
    }

    // Update mesh position
    this.mesh.position.copy(this.position);

    // Cooldown management
    if (this.shootCooldown > 0) {
      this.shootCooldown -= deltaTime * 1000;
      if (this.shootCooldown < 0) this.shootCooldown = 0;
    }

    // Shield timer
    if (this.isShielded && this.shieldTimer > 0) {
      this.shieldTimer -= deltaTime;
      if (this.shieldTimer <= 0) {
        this.deactivateShield();
      }
    }
  }

  canShoot(): boolean {
    return this.shootCooldown <= 0;
  }

  startCooldown(): void {
    this.shootCooldown = this.shootDelay;
  }

  activateShield(): void {
    if (!this.isShielded) {
      this.isShielded = true;
      this.shieldTimer = 5.0; // 5 seconds shield duration
      
      // Create shield visual
      const shieldGeo = new THREE.SphereGeometry(1.5, 16, 16);
      const shieldMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      
      this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
      this.shieldMesh.position.y = 0.5;
      this.mesh.add(this.shieldMesh);
    }
  }

  deactivateShield(): void {
    if (this.isShielded && this.shieldMesh) {
      this.isShielded = false;
      this.mesh.remove(this.shieldMesh);
      this.shieldMesh.geometry.dispose();
      this.shieldMesh.material.dispose();
      this.shieldMesh = null;
    }
  }

  isShieldActive(): boolean {
    return this.isShielded;
  }

  get shieldTimeRemaining(): number {
    return this.isShielded ? Math.max(0, this.shieldTimer) : 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    } else if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(m => m.dispose());
    }
    
    if (this.shieldMesh) {
      this.shieldMesh.geometry.dispose();
      this.shieldMesh.material.dispose();
    }
  }

  reset(): void {
    this.position.set(0, -2.5, 0);
    this.mesh.position.copy(this.position);
    this.velocity = 0;
    this.shootCooldown = 0;
    this.deactivateShield();
  }
}