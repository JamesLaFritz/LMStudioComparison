import { IndividualAlien } from './alien.js';
import { createAlienMesh, ALIEN_TYPES } from '../rendering/alienMesh.js';
import { NEON_COLORS, BOUNDARY_X, PLAYER_Y, SPACE_INVADERS } from '../../shared/constants.js';

export class AlienGrid {
  constructor(scene, vfxSystems, audioSynth) {
    this.scene = scene;
    this.vfxSystems = vfxSystems;
    this.audioSynth = audioSynth;
    this.rows = SPACE_INVADERS.ALIEN_ROWS;
    this.cols = SPACE_INVADERS.ALIEN_COLS;
    this.aliens = []; // Flat array of all aliens
    
    this.direction = 1; // 1 = right, -1 = left
    this.baseSpeed = SPACE_INVADERS.ALIEN_BASE_SPEED;
    this.speedMultiplier = 1.0;
    this.dropDistance = SPACE_INVADERS.ALIEN_DROP_DISTANCE;
    
    this.alienWidth = 2.6;
    this.alienHeight = 1.8;
    this.spacingX = SPACE_INVADERS.ALIEN_SPACING_X;
    this.spacingY = SPACE_INVADERS.ALIEN_SPACING_Y;
    
    // Calculate grid center position
    const totalGridWidth = (this.cols - 1) * this.spacingX + this.alienWidth;
    const startX = -totalGridWidth / 2;
    const startY = SPACE_INVADERS.ALIEN_START_Y;
    
    // Create aliens in grid formation
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const type = this.getAlienTypeForRow(row);
        const x = startX + col * this.spacingX;
        const y = startY - row * this.spacingY;
        
        const alien = new IndividualAlien(type, x, y, scene, vfxSystems, audioSynth);
        this.aliens.push(alien);
      }
    }
    
    // Track alive count for difficulty scaling
    this.initialCount = this.aliens.length;
  }
  
  getAlienTypeForRow(row) {
    if (row <= 1) return 'squid';
    if (row <= 3) return 'crab';
    return 'octopus';
  }
  
  update(dt, difficultyMultiplier) {
    // Update speed based on remaining aliens (fewer = faster)
    const aliveCount = this.getAliveCount();
    const progress = (this.initialCount - aliveCount) / this.initialCount;
    this.speedMultiplier = 1.0 + progress * 2.0; // Up to 3x speed
    
    const moveSpeed = this.baseSpeed * this.speedMultiplier * difficultyMultiplier;
    
    // Check for edge collision before moving
    let hitLeftEdge = false;
    let hitRightEdge = false;
    
    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      
      const rightBound = alien.x + this.alienWidth / 2;
      const leftBound = alien.x - this.alienWidth / 2;
      
      if (leftBound < -BOUNDARY_X) hitLeftEdge = true;
      if (rightBound > BOUNDARY_X) hitRightEdge = true;
    }
    
    // Move horizontally
    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      
      alien.x += moveSpeed * this.direction * dt * 60;
    }
    
    // Handle edge collision - drop and reverse
    if ((this.direction === 1 && hitRightEdge) || (this.direction === -1 && hitLeftEdge)) {
      this.reverseAndDrop();
    }
    
    // Update individual alien animations/states
    for (const alien of this.aliens) {
      if (alien.alive) {
        alien.update(dt, this.direction);
      }
    }
  }
  
  reverseAndDrop() {
    this.direction *= -1;
    
    // Drop all aliens down
    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      
      alien.y -= this.dropDistance;
      
      // Trigger squash animation on drop
      alien.triggerSquash();
    }
  }
  
  getAliveCount() {
    return this.aliens.filter(a => a.alive).length;
  }
  
  isAllDead() {
    return this.getAliveCount() === 0;
  }
  
  hasReachedBottom() {
    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      
      const bottomY = alien.y - this.alienHeight / 2;
      if (bottomY <= PLAYER_Y + 10) {
        return true;
      }
    }
    return false;
  }
  
  getAliensForType(type) {
    return this.aliens.filter(a => a.type === type && a.alive);
  }
  
  // Find random alive alien for shooting
  getRandomShooter() {
    const alive = this.aliens.filter(a => a.alive);
    if (alive.length === 0) return null;
    
    // Prefer bottom-row aliens, then random from each column's lowest
    const byColumn = {};
    for (const alien of alive) {
      const colIndex = Math.round((alien.x + BOUNDARY_X) / this.spacingX);
      if (!byColumn[colIndex] || alien.y > byColumn[colIndex].y) {
        byColumn[colIndex] = alien;
      }
    }
    
    const columnShots = Object.values(byColumn);
    if (columnShots.length === 0) return null;
    
    return columnShots[Math.floor(Math.random() * columnShots.length)];
  }
  
  destroyAlien(alien) {
    alien.alive = false;
    alien.destroy();
  }
  
  reset(scene, newDifficultyMultiplier = 1.0) {
    // Dispose old aliens
    for (const alien of this.aliens) {
      alien.dispose();
    }
    
    // Rebuild grid with increased difficulty
    this.baseSpeed *= newDifficultyMultiplier;
    this.speedMultiplier = 1.0;
    
    const totalGridWidth = (this.cols - 1) * this.spacingX + this.alienWidth;
    const startX = -totalGridWidth / 2;
    const startY = PLAYER_Y - 80;
    
    this.aliens = [];
    
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const type = this.getAlienTypeForRow(row);
        const x = startX + col * this.spacingX;
        const y = startY - row * this.spacingY;
        
        const alien = new IndividualAlien(type, x, y, scene);
        this.aliens.push(alien);
      }
    }
    
    this.initialCount = this.aliens.length;
  }
  
  dispose() {
    for (const alien of this.aliens) {
      alien.dispose();
    }
    this.aliens = [];
  }
}
