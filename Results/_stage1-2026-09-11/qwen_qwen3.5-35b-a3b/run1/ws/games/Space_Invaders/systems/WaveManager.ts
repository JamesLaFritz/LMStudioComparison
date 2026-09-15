import { Enemy } from '../entities/Enemy.js';
import { ProjectilePool, Projectile } from '../entities/Projectile.js';
import { PowerUp, PowerUpType } from '../entities/PowerUp.js';
import { CONFIG as config } from '../config.js';
import { MathUtils } from '../../../shared/utils/MathUtils.js';

export class WaveManager {
  private enemyGrid: Enemy[][] = [];
  private enemyPool: ProjectilePool | null = null;
  private powerUps: PowerUp[] = [];
  private ufoSpawnTimer: number = 0;
  private ufoActive: boolean = false;
  private ufoMesh: THREE.Mesh | null = null;
  
  private totalEnemies: number = 0;
  private enemiesRemaining: number = 0;
  private waveNumber: number = 1;

  constructor() {
    this.resetWave();
  }

  resetWave(): void {
    // Clear existing grid
    for (let i = 0; i < this.enemyGrid.length; i++) {
      for (let j = 0; j < this.enemyGrid[i].length; j++) {
        if (this.enemyGrid[i][j]) {
          this.enemyGrid[i][j]!.dispose();
        }
      }
    }
    this.enemyGrid = [];

    // Create new grid based on wave number
    const rows = Math.min(5, 3 + Math.floor(this.waveNumber / 2));
    const cols = Math.min(10, 6 + Math.floor(this.waveNumber / 3));
    
    for (let i = 0; i < rows; i++) {
      this.enemyGrid[i] = [];
      for (let j = 0; j < cols; j++) {
        const enemy = new Enemy(
          config.enemyPositions[j][i], // Starting position
          i,                          // Row index determines color/score
          j,                          // Column index
          this.waveNumber             // Difficulty scaling
        );
        this.enemyGrid[i][j] = enemy;
      }
    }

    this.totalEnemies = rows * cols;
    this.enemiesRemaining = this.totalEnemies;
    this.ufoSpawnTimer = 0;
    this.ufoActive = false;
    
    // Clear power-ups
    for (const powerUp of this.powerUps) {
      powerUp.dispose();
    }
    this.powerUps = [];
  }

  update(deltaTime: number, camera: THREE.Camera): void {
    if (!this.ufoActive && Math.random() < config.ufoSpawnChance * deltaTime) {
      this.spawnUFO(camera);
    }

    // Update UFO if active
    if (this.ufoActive && this.ufoMesh) {
      const speed = 2.0 + this.waveNumber * 0.3;
      this.ufoMesh.position.x += speed * deltaTime;
      
      // Check bounds and reverse direction
      if (this.ufoMesh.position.x > config.screenBounds.right || 
          this.ufoMesh.position.x < config.screenBounds.left) {
        this.deactivateUFO();
      }

      // UFO shooting logic
      if (Math.random() < 0.01 * deltaTime) {
        this.spawnEnemyProjectile(this.ufoMesh.position.clone());
      }
    }
  }

  spawnUFO(camera: THREE.Camera): void {
    const ufoGeometry = new THREE.CapsuleGeometry(0.8, 0.5, 4, 8);
    const ufoMaterial = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      emissiveIntensity: 1.2,
      metalness: 0.9,
      roughness: 0.1
    });
    
    this.ufoMesh = new THREE.Mesh(ufoGeometry, ufoMaterial);
    const spawnX = config.screenBounds.left + Math.random() * (config.screenBounds.right - config.screenBounds.left);
    this.ufoMesh.position.set(spawnX, config.screenBounds.top - 2, 0);
    
    camera.scene?.add(this.ufoMesh);
    this.ufoActive = true;
    this.ufoSpawnTimer = 0;
  }

  deactivateUFO(): void {
    if (this.ufoMesh) {
      const scene = this.ufoMesh.parent as THREE.Scene | null;
      if (scene) {
        scene.remove(this.ufoMesh);
      }
      this.ufoMesh.geometry.dispose();
      this.ufoMesh.material.dispose();
      this.ufoMesh = null;
    }
    this.ufoActive = false;
  }

  spawnEnemyProjectile(position: THREE.Vector3): Projectile | null {
    if (!this.enemyPool) return null;
    const projectile = this.enemyPool.spawnEnemy(position);
    return projectile;
  }

  spawnPowerUp(position: THREE.Vector3, type: PowerUpType): void {
    const powerUp = new PowerUp(position, type);
    this.powerUps.push(powerUp);
    
    // Scene reference will be set by game manager
    setTimeout(() => {
      if (powerUp.mesh && powerUp.mesh.parent) {
        powerUp.mesh.parent.remove(powerUp.mesh);
      }
      powerUp.dispose();
    }, 5000); // Auto-remove after 5 seconds
  }

  getEnemyGrid(): Enemy[][] {
    return this.enemyGrid;
  }

  getEnemiesRemaining(): number {
    return this.enemiesRemaining;
  }

  getTotalEnemies(): number {
    return this.totalEnemies;
  }

  incrementWave(): void {
    this.waveNumber++;
    this.resetWave();
  }

  enemyKilled(row: number): void {
    this.enemiesRemaining--;
    
    // Chance to spawn power-up on kill (increases with wave)
    if (Math.random() < config.powerUpDropChance + (this.waveNumber * 0.01)) {
      const types: PowerUpType[] = ['rapidFire', 'spreadShot', 'shield'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      // Find enemy position for power-up spawn
      let spawnPos = new THREE.Vector3();
      for (let j = 0; j < this.enemyGrid[row]?.length; j++) {
        if (this.enemyGrid[row][j]) {
          spawnPos.copy(this.enemyGrid[row][j]!.mesh.position);
          break;
        }
      }
      
      if (spawnPos.length() > 0) {
        this.spawnPowerUp(spawnPos, type);
      }
    }

    // Check for wave completion
    if (this.enemiesRemaining === 0) {
      setTimeout(() => {
        this.incrementWave();
      }, 2000);
    }
  }

  dispose(): void {
    this.deactivateUFO();
    
    for (let i = 0; i < this.enemyGrid.length; i++) {
      for (const enemy of this.enemyGrid[i]) {
        if (enemy) enemy.dispose();
      }
    }
    
    for (const powerUp of this.powerUps) {
      powerUp.dispose();
    }
  }

  setEnemyPool(pool: ProjectilePool): void {
    this.enemyPool = pool;
  }
}