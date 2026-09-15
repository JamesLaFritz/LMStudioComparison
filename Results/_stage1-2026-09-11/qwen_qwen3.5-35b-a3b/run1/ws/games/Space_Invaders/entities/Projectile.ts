import { ObjectPool } from '../../../shared/core/ObjectPool.js';
import { MotionTrails } from '../../../shared/vfx/MotionTrails.js';
import { MathUtils } from '../../../shared/utils/MathUtils.js';

export interface ProjectileConfig {
  speed: number;
  damage: number;
  trailLength: number;
  color: number;
}

export class Projectile {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  velocity: THREE.Vector3 = new THREE.Vector3(0, -1, 0);
  isPlayerProjectile: boolean;
  active: boolean = false;
  trailSystem: MotionTrails | null = null;
  
  private _position: THREE.Vector3 = new THREE.Vector3();
  private _speed: number;
  private _trailLength: number;
  private _color: number;

  constructor(
    position: THREE.Vector3,
    config: ProjectileConfig,
    isPlayerProjectile: boolean,
    trailSystem: MotionTrails | null = null
  ) {
    this._speed = config.speed;
    this._trailLength = config.trailLength;
    this._color = config.color;
    this.isPlayerProjectile = isPlayerProjectile;
    
    // Create geometry and material for projectile
    const geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
    geometry.rotateX(Math.PI / 2);
    
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 1.5,
      metalness: 0.8,
      roughness: 0.2
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    this._position.copy(position);
    
    // Initialize motion trails if provided
    if (trailSystem) {
      this.trailSystem = trailSystem;
      this.trailSystem.addTrail(this.mesh, config.color, config.trailLength);
    }
  }

  update(deltaTime: number): void {
    if (!this.active) return;
    
    // Update position based on velocity
    const moveDistance = this._speed * deltaTime;
    this.mesh.position.addScaledVector(this.velocity, moveDistance);
    this._position.copy(this.mesh.position);
    
    // Update motion trail positions
    if (this.trailSystem) {
      this.trailSystem.updateTrail(this.mesh);
    }
    
    // Bounds check: remove when off-screen to prevent memory leaks
    if (this.isPlayerProjectile && this.mesh.position.y < -15) {
      this.deactivate();
    } else if (!this.isPlayerProjectile && this.mesh.position.y > 15) {
      this.deactivate();
    }
  }

  deactivate(): void {
    this.active = false;
    this.mesh.visible = false;
    if (this.trailSystem) {
      this.trailSystem.removeTrail(this.mesh);
    }
  }

  activate(position: THREE.Vector3, direction: number): void {
    this._position.copy(position);
    this.mesh.position.copy(position);
    this.active = true;
    this.mesh.visible = true;
    
    // Set velocity based on projectile type
    if (this.isPlayerProjectile) {
      this.velocity.set(0, -1, 0);
    } else {
      this.velocity.set(0, 1, 0);
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    if (this.trailSystem) {
      this.trailSystem.removeTrail(this.mesh);
    }
  }
}

export class ProjectilePool extends ObjectPool<Projectile> {
  private trailSystem: MotionTrails | null = null;
  private config: ProjectileConfig;

  constructor(
    maxSize: number,
    config: ProjectileConfig,
    trailSystem: MotionTrails | null = null
  ) {
    super(maxSize);
    this.config = config;
    this.trailSystem = trailSystem;
  }

  protected createInstance(): Projectile {
    return new Projectile(
      new THREE.Vector3(),
      this.config,
      false, // Will be set when activating
      this.trailSystem
    );
  }

  spawnPlayer(position: THREE.Vector3): Projectile | null {
    const projectile = this.acquire();
    if (projectile) {
      projectile.isPlayerProjectile = true;
      projectile.activate(position, 1);
      return projectile;
    }
    return null;
  }

  spawnEnemy(position: THREE.Vector3): Projectile | null {
    const projectile = this.acquire();
    if (projectile) {
      projectile.isPlayerProjectile = false;
      projectile.activate(position, -1);
      return projectile;
    }
    return null;
  }

  dispose(): void {
    super.dispose();
    this.trailSystem = null;
  }
}