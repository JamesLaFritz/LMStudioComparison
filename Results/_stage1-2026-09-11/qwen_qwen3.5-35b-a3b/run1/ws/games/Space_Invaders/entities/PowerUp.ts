import { ObjectPool } from '../../../shared/core/ObjectPool.js';
import { MathUtils } from '../../../shared/utils/MathUtils.js';

export interface PowerUpConfig {
  speed: number;
  duration: number;
  type: 'rapid' | 'spread' | 'shield';
  color: number;
}

export class PowerUp {
  mesh: THREE.Mesh<THREE.MeshStandardMaterial>;
  position: THREE.Vector3 = new THREE.Vector3();
  active: boolean = false;
  powerUpType: 'rapid' | 'spread' | 'shield';
  duration: number;
  spawnTime: number = 0;

  constructor(config: PowerUpConfig) {
    this.powerUpType = config.type;
    this.duration = config.duration;
    
    // Create geometry based on power-up type
    let geometry: THREE.BufferGeometry;
    switch (config.type) {
      case 'rapid':
        geometry = new THREE.ConeGeometry(0.3, 0.8, 8);
        break;
      case 'spread':
        geometry = new THREE.TetrahedronGeometry(0.4);
        break;
      case 'shield':
        geometry = new THREE.SphereGeometry(0.35, 16, 16);
        break;
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 1.2,
      metalness: 0.7,
      roughness: 0.3
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.position.copy(this.mesh.position);
  }

  update(deltaTime: number): void {
    if (!this.active) return;
    
    // Move downward
    this.position.y -= config.powerUpSpeed * deltaTime;
    this.mesh.position.copy(this.position);
    
    // Rotate for visual effect
    this.mesh.rotation.z += deltaTime * 2;
    this.mesh.rotation.x += deltaTime * 1.5;
    
    // Check if expired (fell off screen)
    if (this.position.y < -10) {
      this.deactivate();
    }
    
    // Update duration timer
    const elapsed = Date.now() - this.spawnTime;
    if (elapsed > this.duration * 1000) {
      this.deactivate();
    }
  }

  deactivate(): void {
    this.active = false;
    this.mesh.visible = false;
  }

  activate(position: THREE.Vector3): void {
    this.position.copy(position);
    this.mesh.position.copy(position);
    this.active = true;
    this.mesh.visible = true;
    this.spawnTime = Date.now();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export class PowerUpPool extends ObjectPool<PowerUp> {
  private config: PowerUpConfig;

  constructor(maxSize: number, config: PowerUpConfig) {
    super(maxSize);
    this.config = config;
  }

  protected createInstance(): PowerUp {
    return new PowerUp(this.config);
  }

  spawn(position: THREE.Vector3): PowerUp | null {
    const powerUp = this.acquire();
    if (powerUp) {
      powerUp.activate(position);
      return powerUp;
    }
    return null;
  }

  dispose(): void {
    super.dispose();
  }
}
