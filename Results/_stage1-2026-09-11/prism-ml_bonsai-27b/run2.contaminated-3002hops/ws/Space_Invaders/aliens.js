/**
 * Space_Invaders - Alien Grid System
 * 
 * Manages the alien grid with step-down movement, type-based behavior,
 * and progressive difficulty. All aliens are rendered via InstancedMesh for
 * performance. The grid moves horizontally, steps down when hitting boundaries,
 * and increases velocity as aliens are destroyed.
 */

import { vec3, lerp } from '../shared/utils/math.js';
import { createInstancedMesh } from '../shared/vfx/particles.js';

// ─── Alien Type Definitions ──────────────────────────────────────────────

const ALIEN_TYPES = ['squid', 'crab', 'octopus'];

const ALIEN_CONFIG = {
  squid:   { points: 30, color: [0.5, 1.0, 1.2], rows: 1 },
  crab:    { points: 20, color: [1.2, 0.4, 1.0], rows: 3 },
  octopus: { points: 10, color: [1.2, 1.0, 0.4], rows: 1 },
};

// ─── Sprite Data (pixel arrays for Canvas generation) ──────────────────────
// Each row is a string of '#' (drawn) and '.' (empty). Width = 32, Height = 32.

const ALIEN_SPRITES = {
  squid: [
    '.....................#.#..',
    '..################....#...',
    '.################.......#.',
    '...############.........#...',
    '...##########.............#...',
    '...#####..........#......#...',
    '...#.###.##..........#....#...',
    '...#..#.....#........#....#...',
    '..#.#..#......#.......#....',
    '.#..#..#....#.........#...',
    '#..#..#.....#...........#...',
  ],
  crab: [
    '.....................#.#..',
    '..################....#...',
    '.################.......#.',
    '...############.........#...',
    '...##########.............#...',
    '...#####..........#......#...',
    '...#.###.##..........#....#...',
    '...#..#.....#........#....#...',
    '..#.#..#......#.......#....',
    '.#..#..#....#.........#...',
    '#..#..#.....#...........#...',
  ],
  octopus: [
    '.....................#.#..',
    '..################....#...',
    '.################.......#.',
    '...############.........#...',
    '...##########.............#...',
    '...#####..........#......#...',
    '...#.###.##..........#....#...',
    '...#..#.....#........#....#...',
    '..#.#..#......#.......#....',
    '.#..#..#....#.........#...',
    '#..#..#.....#...........#...',
  ],
};

// ─── Main Class ──────────────────────────────────────────────────────────

export class AlienGrid {
  constructor(scene, playerX, playerY, width, height) {
    this.scene = scene;
    this.playerX = playerX;
    this.playerY = playerY;
    this.width = width;
    this.height = height;

    // Grid configuration
    this.columns = 11;
    this.rows = 5;
    this.gridSpacingX = 60;
    this.gridSpacingY = 45;
    this.initialAliens = this.columns * this.rows;
    this.currentAliens = this.initialAliens;

    // Movement state
    this.direction = 1; // 1 = right, -1 = left
    this.velocity = 30; // pixels/sec
    this.baseVelocity = 30;
    this.stepDown = 12;
    this.moveTimer = 0;
    this.moveInterval = 0.5; // seconds between steps (decreases as aliens die)

    // Type assignment: rows 0-1 = squid, rows 2-4 = crab, row 5+ = octopus
    this.alienTypes = [];
    this.alienPoints = [];
    this.alienShootProbabilities = [];

    // Build the grid
    this._buildGrid();

    // Create instanced mesh for all aliens
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);

    // Track alive indices for efficient rendering
    this.aliveIndices = new Set();
    for (let i = 0; i < this.initialAliens; i++) {
      this.aliveIndices.add(i);
    }

    // Update interval based on initial count
    this.moveInterval = Math.max(0.1, 2 - (this.initialAliens / 55) * 1.5);
  }

  _buildGrid() {
    this.alienData = []; // Array of { x, y, type, points, alive }

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const typeIdx = row < ALIEN_CONFIG.squid.rows ? 0 :
                        row < ALIEN_CONFIG.squid.rows + ALIEN_CONFIG.crab.rows ? 1 : 2;
        const type = ALIEN_TYPES[typeIdx];

        this.alienData.push({
          x: (col * this.gridSpacingX) + (this.width - (this.columns * this.gridSpacingX)) / 2,
          y: (row * this.gridSpacingY) + (this.height - (this.rows * this.gridSpacingY)) / 2,
          type: type,
          points: ALIEN_CONFIG[type].points,
          alive: true,
        });
      }
    }

    // Pre-calculate shoot probabilities per alien based on type
    const probMap = { squid: 0.02, crab: 0.05, octopus: 0.08 };
    for (let i = 0; i < this.alienData.length; i++) {
      this.alienShootProbabilities[i] = probMap[this.alienData[i].type];
    }
  }

  update(dt) {
    // Calculate current velocity based on wave and remaining aliens
    const aliveCount = this._countAlive();
    const speedMultiplier = 1 + (this.currentWave || 0) * 0.3;
    const destructionBonus = (this.initialAliens - aliveCount) / this.initialAliens * 0.5;
    this.velocity = this.baseVelocity * speedMultiplier * (1 + destructionBonus);

    // Update move interval as aliens are destroyed
    this.moveInterval = Math.max(0.1, 2 - (this.currentWave || 0) * 0.3);

    // Horizontal movement
    const stepDistance = this.velocity * dt;
    for (const alien of this.alienData) {
      if (!alien.alive) continue;
      alien.x += stepDistance * this.direction;
    }

    // Check boundaries and step down
    const minX = 20;
    const maxX = this.width - 40;

    let hitBoundary = false;
    for (const alien of this.alienData) {
      if (!alien.alive) continue;
      if ((this.direction === 1 && alien.x > maxX) ||
          (this.direction === -1 && alien.x < minX)) {
        hitBoundary = true;
        break;
      }
    }

    if (hitBoundary) {
      this._stepDown();
    }

    // Alien shooting logic
    this._tryShoot(dt);
  }

  _countAlive() {
    let count = 0;
    for (const alien of this.alienData) {
      if (alien.alive) count++;
    }
    return count;
  }

  _stepDown() {
    // Step all aliens down and reverse direction
    for (const alien of this.alienData) {
      if (alien.alive) {
        alien.y += this.stepDown;
      }
    }
    this.direction *= -1;
  }

  _tryShoot(dt) {
    // Find bottom-most alive aliens per column
    const bottomAliens = {}; // col -> index of bottom-most alive alien
    for (let i = 0; i < this.alienData.length; i++) {
      if (!this.alienData[i].alive) continue;
      const col = Math.floor((i - (i % this.columns)) / this.columns);
      if (!bottomAliens[col] || this.alienData[i].y > bottomAliens[col].y) {
        bottomAliens[col] = i;
      }
    }

    // Randomly select a shooter from bottom aliens
    const candidates = Object.values(bottomAliens).filter(idx => {
      return this.alienData[idx].alive && Math.random() < 0.3;
    });

    if (candidates.length > 0) {
      const shooterIdx = candidates[Math.floor(Math.random() * candidates.length)];
      const alien = this.alienData[shooterIdx];
      // Return the shooter's position for projectile spawning
      return { x: alien.x, y: alien.y + 16 }; // Shoot from bottom of sprite
    }

    return null;
  }

  destroyAlien(index) {
    if (index < 0 || index >= this.alienData.length) return false;
    const alien = this.alienData[index];
    if (!alien.alive) return false;

    alien.alive = false;
    this.currentAliens--;

    // Check for wave clear
    if (this.currentAliens <= 0) {
      this.waveComplete();
      return true;
    }

    return true;
  }

  getAliveData() {
    const data = [];
    for (const alien of this.alienData) {
      if (alien.alive) {
        data.push({ ...alien });
      }
    }
    return data;
  }

  waveComplete() {
    // Signal that the current wave is complete
    this.waveComplete = true;
    this.waveComplete = false; // Reset for next call
  }

  reset(waveNumber) {
    this.currentWave = waveNumber || 1;
    this.direction = 1;
    this.velocity = this.baseVelocity * (1 + (waveNumber - 1) * 0.3);
    this.moveInterval = Math.max(0.1, 2 - (waveNumber - 1) * 0.3);

    // Reset all aliens to initial positions
    for (let i = 0; i < this.alienData.length; i++) {
      const col = i % this.columns;
      const row = Math.floor(i / this.columns);
      const typeIdx = row < ALIEN_CONFIG.squid.rows ? 0 :
                      row < ALIEN_CONFIG.squid.rows + ALIEN_CONFIG.crab.rows ? 1 : 2;
      const type = ALIEN_TYPES[typeIdx];

      this.alienData[i].x = (col * this.gridSpacingX) + (this.width - (this.columns * this.gridSpacingX)) / 2;
      this.alienData[i].y = (row * this.gridSpacingY) + (this.height - (this.rows * this.gridSpacingY)) / 2;
      this.alienData[i].type = type;
      this.alienData[i].points = ALIEN_CONFIG[type].points;
      this.alienData[i].alive = true;
    }

    // Reset alive indices
    for (let i = 0; i < this.initialAliens; i++) {
      this.aliveIndices.add(i);
    }
  }

  getShootPosition() {
    const result = this._tryShoot(0);
    return result ? { x: result.x, y: result.y } : null;
  }
}