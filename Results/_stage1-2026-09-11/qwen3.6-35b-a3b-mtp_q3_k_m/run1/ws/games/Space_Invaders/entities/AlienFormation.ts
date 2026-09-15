/**
 * Alien formation manager — handles marching, edge detection, firing, and acceleration.
 */

import { Vector3 } from 'three';
import { clamp, randomRange } from '@shared/utils/MathUtils';
import { ALIEN_GRID_ROWS, ALIEN_GRID_COLS, TOTAL_ALIENS, ALIEN_SPEED_MIN, ALIEN_SPEED_MAX, SCREEN_LEFT, SCREEN_RIGHT, ALIEN_DROP_DISTANCE, PLAYER_Z, ALIEN_BASE_FIRE_RATE, ALIEN_COLORS } from '@shared/utils/Constants';
import { Alien } from './Alien';

export class AlienFormation {
  private grid: (Alien | null)[][] = [];
  private aliveCount: number = TOTAL_ALIENS;
  private direction: number = 1; // +1 = right, -1 = left
  private baseSpeed: number = ALIEN_SPEED_MIN;
  private formationPos: Vector3 = new Vector3();
  private stepDownTimer: number = 0;

  // Grid layout positions (computed at init)
  private colSpacing: number = 0.9;
  private rowSpacing: number = 0.7;
  private startX: number = -5.4; // center the grid
  private startZ: number = -3.5;

  constructor(baseSpeed?: number) {
    if (baseSpeed !== undefined) this.baseSpeed = baseSpeed;
    this.buildGrid();
  }

  /** Build the alien grid from scratch */
  buildGrid(): void {
    this.grid = [];
    this.aliveCount = TOTAL_ALIENS;
    this.direction = 1;
    this.formationPos.set(0, -3, this.startZ);

    for (let row = 0; row < ALIEN_GRID_ROWS; row++) {
      const gridRow: (Alien | null)[] = [];
      for (let col = 0; col < ALIEN_GRID_COLS; col++) {
        // Determine alien type based on row
        let type = 4; // default Type C
        if (row === 0) type = 0;       // top row = Type A
        else if (row <= 2) type = 1;   // rows 1-2 = Type B
        else if (row <= 3) type = 3;   // row 3 = Type C variant

        const alien = new Alien(type, row, col);
        gridRow.push(alien);
      }
      this.grid.push(gridRow);
    }

    this.updatePositions();
  }

  /** Update world positions of all aliens based on formation offset */
  updatePositions(): void {
    for (let row = 0; row < ALIEN_GRID_ROWS; row++) {
      for (let col = 0; col < ALIEN_GRID_COLS; col++) {
        const alien = this.grid[row][col];
        if (!alien) continue;

        const x = this.formationPos.x + col * this.colSpacing;
        const z = this.formationPos.z + row * this.rowSpacing;
        alien.position.set(x, -3, z);
        alien.mesh.position.copy(alien.position);
      }
    }
  }

  /** Get the current alive count */
  getAliveCount(): number {
    return this.aliveCount;
  }

  /** Get base speed (used for acceleration calc) */
  getBaseSpeed(): number {
    return this.baseSpeed;
  }

  /** Set wave-specific difficulty parameters */
  setDifficulty(wave: number): void {
    this.baseSpeed = ALIEN_SPEED_MIN + (wave - 1) * 0.15;
    if (this.baseSpeed > ALIEN_SPEED_MAX) this.baseSpeed = ALIEN_SPEED_MAX;
  }

  /** Update formation movement and firing */
  update(dt: number): void {
    const speedMultiplier = 1 + (TOTAL_ALIENS - this.aliveCount) / TOTAL_ALIENS * 2.5;
    const currentSpeed = this.baseSpeed * speedMultiplier * this.direction;

    // Move formation horizontally
    this.formationPos.x += currentSpeed * dt;

    // Check edge collision
    let hitEdge = false;
    for (let row = 0; row < ALIEN_GRID_ROWS && !hitEdge; row++) {
      for (let col = 0; col < ALIEN_GRID_COLS && !hitEdge; col++) {
        const alien = this.grid[row][col];
        if (!alien || !alien.alive) continue;

        const x = this.formationPos.x + col * this.colSpacing;
        if (x > SCREEN_RIGHT - 0.5 || x < SCREEN_LEFT + 0.5) {
          hitEdge = true;
        }
      }
    }

    if (hitEdge) {
      this.stepDown();
    }

    // Update each alien's animation
    for (let row = 0; row < ALIEN_GRID_ROWS; row++) {
      for (let col = 0; col < ALIEN_GRID_COLS; col++) {
        const alien = this.grid[row][col];
        if (!alien || !alien.alive) continue;

        // Update edge glow flag
        const x = this.formationPos.x + col * this.colSpacing;
        if (x > SCREEN_RIGHT - 1.0 || x < SCREEN_LEFT + 1.0) {
          alien.triggerEdgeGlow();
        }

        alien.update(dt, currentSpeed);
      }
    }

    // Check if aliens reached player plane (instant loss condition)
    for (let row = 0; row < ALIEN_GRID_ROWS; row++) {
      for (let col = 0; col < ALIEN_GRID_COLS; col++) {
        const alien = this.grid[row][col];
        if (!alien || !alien.alive) continue;
        if (alien.position.z >= PLAYER_Z - 0.5) {
          // Aliens reached player — trigger game over
          this.triggerGameOver();
          return;
        }
      }
    }
  }

  /** Step formation down and reverse direction */
  stepDown(): void {
    this.direction *= -1;
    this.formationPos.z += ALIEN_DROP_DISTANCE * this.direction; // drop in Z (toward player)
    
    // Trigger edge glow on all alive aliens
    for (let row = 0; row < ALIEN_GRID_ROWS; row++) {
      for (let col = 0; col < ALIEN_GRID_COLS; col++) {
        const alien = this.grid[row][col];
        if (alien && alien.alive) {
          alien.triggerEdgeGlow();
        }
      }
    }
  }

  /** Attempt to fire alien shots — returns array of projectiles */
  tryFireShots(): Array<{ position: Vector3; velocity: Vector3 }> {
    const shots: Array<{ position: Vector3; velocity: Vector3 }> = [];
    const speedMultiplier = 1 + (TOTAL_ALIENS - this.aliveCount) / TOTAL_ALIENS * 2.0;

    // Find bottom-most alive alien in each column (they fire first)
    for (let col = 0; col < ALIEN_GRID_COLS; col++) {
      let bottomAlien: Alien | null = null;
      for (let row = ALIEN_GRID_ROWS - 1; row >= 0; row--) {
        const alien = this.grid[row][col];
        if (alien && alien.alive) {
          bottomAlien = alien;
          break;
        }
      }

      if (!bottomAlien) continue;

      // Fire chance based on type and speed multiplier
      let fireChance = ALIEN_BASE_FIRE_RATE[bottomAlien.type] || 0.003;
      fireChance *= speedMultiplier;

      if (Math.random() < fireChance) {
        const bulletSpeed = 4 + randomRange(0, 3);
        shots.push({
          position: new Vector3(bottomAlien.position.x, bottomAlien.position.y - 0.3, bottomAlien.position.z),
          velocity: new Vector3(0, -bulletSpeed, 0),
        });
      }
    }

    return shots;
  }

  /** Check if all aliens are destroyed */
  isAllDestroyed(): boolean {
    return this.aliveCount <= 0;
  }

  /** Mark an alien as destroyed and decrement count */
  destroyAlien(row: number, col: number): void {
    const alien = this.grid[row]?.[col];
    if (alien && alien.alive) {
      alien.deactivate();
      this.aliveCount--;
    }
  }

  /** Trigger game over condition */
  private triggerGameOver(): void {
    // Signal to the game system — handled via callback in Game.ts
    // This is a no-op here; the caller checks positions each frame
  }

  /** Get all alive aliens for collision checking */
  getAliveAliens(): Alien[] {
    const result: Alien[] = [];
    for (let row = 0; row < ALIEN_GRID_ROWS; row++) {
      for (let col = 0; col < ALIEN_GRID_COLS; col++) {
        const alien = this.grid[row][col];
        if (alien && alien.alive) result.push(alien);
      }
    }
    return result;
  }

  /** Dispose all Three.js resources */
  dispose(): void {
    for (let row = 0; row < ALIEN_GRID_ROWS; row++) {
      for (let col = 0; col < ALIEN_GRID_COLS; col++) {
        const alien = this.grid[row][col];
        if (alien) alien.dispose();
      }
    }
    this.grid.length = 0;
  }

  /** Get formation position */
  getFormationPos(): Vector3 {
    return this.formationPos;
  }
}