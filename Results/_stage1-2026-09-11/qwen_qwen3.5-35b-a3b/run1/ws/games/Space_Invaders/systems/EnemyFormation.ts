import { Enemy } from '../entities/Enemy.js';
import { MathUtils } from '../../../shared/utils/MathUtils.js';
import { CONFIG as config } from '../config.js';

export class EnemyFormation {
  private enemies: Enemy[][] = [];
  private rows: number;
  private cols: number;
  private spacingX: number;
  private spacingY: number;
  
  // Movement state
  private direction: number = 1; // 1 = right, -1 = left
  private speed: number = config.enemyBaseSpeed;
  private dropDistance: number = 0.5;
  private moveTimer: number = 0;
  private moveInterval: number = 1.0; // seconds between moves
  
  // Formation patterns
  private patternPhase: number = 0;
  private patternSpeed: number = 2.0;

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.spacingX = config.enemySpacingX;
    this.spacingY = config.enemySpacingY;
    
    // Initialize enemy grid
    for (let i = 0; i < rows; i++) {
      this.enemies[i] = [];
      for (let j = 0; j < cols; j++) {
        const position = new THREE.Vector3(
          (j - cols / 2 + 0.5) * this.spacingX,
          config.enemyYOffset + i * this.spacingY,
          0
        );
        
        // Row-based color variation for retro look
        const rowColors = [0xff00ff, 0x00ffff, 0xffff00, 0xff8800];
        const baseColor = rowColors[i % rowColors.length];
        
        this.enemies[i][j] = new Enemy(position, i, cols - 1 - i, baseColor);
      }
    }
  }

  update(deltaTime: number): void {
    if (this.enemies.every(row => row.every(e => !e.active))) {
      return; // All enemies destroyed
    }

    this.moveTimer += deltaTime;
    
    // Move horizontally based on direction
    const moveDistance = this.speed * this.direction * deltaTime;
    
    let hitEdge = false;
    let leftmostX = Infinity;
    let rightmostX = -Infinity;

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const enemy = this.enemies[i][j];
        if (!enemy.active) continue;
        
        enemy.mesh.position.x += moveDistance;
        
        // Track bounds
        leftmostX = Math.min(leftmostX, enemy.mesh.position.x);
        rightmostX = Math.max(rightmostX, enemy.mesh.position.x);
        
        // Check edge collision
        if (enemy.mesh.position.x < config.screenLeftEdge || 
            enemy.mesh.position.x > config.screenRightEdge) {
          hitEdge = true;
        }
      }
    }

    // Reverse direction and drop down if edge reached
    if (hitEdge || this.moveTimer >= this.moveInterval) {
      this.direction *= -1;
      
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          const enemy = this.enemies[i][j];
          if (!enemy.active) continue;
          
          enemy.mesh.position.y -= this.dropDistance * Math.sign(this.direction);
        }
      }
      
      this.moveTimer = 0;
    }

    // Update individual enemy animations and behaviors
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const enemy = this.enemies[i][j];
        if (!enemy.active) continue;
        
        enemy.update(deltaTime);
      }
    }

    // Update pattern phase for formation morphing
    this.patternPhase += this.patternSpeed * deltaTime;
  }

  getActiveEnemies(): Enemy[] {
    const active: Enemy[] = [];
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const enemy = this.enemies[i][j];
        if (enemy.active) active.push(enemy);
      }
    }
    return active;
  }

  getEnemyCount(): number {
    let count = 0;
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        if (this.enemies[i][j].active) count++;
      }
    }
    return count;
  }

  getTotalEnemies(): number {
    return this.rows * this.cols;
  }

  getClosestEnemyToBottom(): Enemy | null {
    let closest: Enemy | null = null;
    let maxY = -Infinity;

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const enemy = this.enemies[i][j];
        if (!enemy.active) continue;
        
        if (enemy.mesh.position.y > maxY) {
          maxY = enemy.mesh.position.y;
          closest = enemy;
        }
      }
    }

    return closest;
  }

  reset(): void {
    this.direction = 1;
    this.speed = config.enemyBaseSpeed;
    this.moveTimer = 0;
    
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const position = new THREE.Vector3(
          (j - this.cols / 2 + 0.5) * this.spacingX,
          config.enemyYOffset + i * this.spacingY,
          0
        );
        
        const rowColors = [0xff00ff, 0x00ffff, 0xffff00, 0xff8800];
        const baseColor = rowColors[i % rowColors.length];
        
        this.enemies[i][j].reset(position, i, this.cols - 1 - i, baseColor);
      }
    }
  }

  increaseDifficulty(): void {
    this.speed = Math.min(this.speed * 1.1, config.maxEnemySpeed);
    this.moveInterval = Math.max(this.moveInterval * 0.9, 0.3);
  }

  dispose(): void {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        this.enemies[i][j].dispose();
      }
    }
  }
}