import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createInvaderGeometry } from '../../shared/procedural/GeometryGenerator.js';

export class Invader {
  constructor(type, row, col, gridX, gridY) {
    this.type = type; // 'squid', 'crab', or 'octopus'
    this.row = row;
    this.col = col;
    
    // Position within the grid formation
    this.localX = 0;
    this.localY = 0;
    
    // Calculate initial position based on grid layout
    const spacingX = CONFIG.invaderSpacingX;
    const spacingY = CONFIG.invaderSpacingY;
    const centerX = (CONFIG.screenWidth - (CONFIG.invaderCols * spacingX)) / 2;
    this.localX = col * spacingX + centerX;
    this.localY = gridY - row * spacingY;
    
    // Mesh creation
    this.geometry = createInvaderGeometry(type);
    this.material = new THREE.MeshStandardMaterial({
      color: CONFIG.colors[type],
      emissive: CONFIG.colors[type],
      emissiveIntensity: 1.5,
      metalness: 0.4,
      roughness: 0.6,
      flatShading: true
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(this.localX, this.localY, 0);
    this.mesh.scale.set(1.5, 1.5, 1.5);
    
    // Animation state
    this.animationFrame = 0;
    this.animationTimer = 0;
    this.isAlive = true;
    
    // Hit squash effect
    this.targetScaleX = 1.5;
    this.targetScaleY = 1.5;
    this.currentScaleX = 1.5;
    this.currentScaleY = 1.5;
    this.squashTimer = 0;
    
    // Value for scoring
    this.points = CONFIG.points[type];
    this.color = CONFIG.colors[type];
  }
  
  update(deltaTime, gridOffset) {
    if (!this.isAlive) return null;
    
    // Animation timer
    this.animationTimer += deltaTime;
    if (this.animationTimer >= 0.15) {
      this.animationTimer = 0;
      this.animationFrame = 1 - this.animationFrame;
      // Flip texture or geometry based on frame
      this.mesh.rotation.z = this.animationFrame === 0 ? 0 : Math.PI * 0.1;
    }
    
    // Squash recovery animation
    if (this.squashTimer > 0) {
      this.squashTimer -= deltaTime;
      const progress = 1 - (this.squashTimer / 0.1);
      this.currentScaleX = THREE.MathUtils.lerp(this.targetScaleX * 1.3, this.targetScaleX, progress);
      this.currentScaleY = THREE.MathUtils.lerp(this.targetScaleY * 0.7, this.targetScaleY, progress);
    } else {
      this.currentScaleX = this.targetScaleX;
      this.currentScaleY = this.targetScaleY;
    }
    
    // Apply squash scale smoothly
    this.mesh.scale.set(
      THREE.MathUtils.lerp(this.mesh.scale.x, this.currentScaleX, 0.2),
      THREE.MathUtils.lerp(this.mesh.scale.y, this.currentScaleY, 0.2),
      this.mesh.scale.z
    );
    
    // Update world position with grid offset
    this.mesh.position.x = this.localX + gridOffset;
    this.mesh.position.y = this.localY;
    
    // Return hitbox for collision detection
    return {
      x: this.mesh.position.x,
      y: this.mesh.position.y,
      width: CONFIG.invaderWidth * this.currentScaleX,
      height: CONFIG.invaderHeight * this.currentScaleY,
      invader: this
    };
  }
  
  squash() {
    // Trigger squash animation for visual feedback
    this.squashTimer = 0.1;
    this.targetScaleX *= 1.3;
    this.targetScaleY *= 0.7;
  }
  
  die() {
    this.isAlive = false;
    return {
      position: new THREE.Vector3(
        this.mesh.position.x,
        this.mesh.position.y,
        0
      ),
      color: CONFIG.colors[this.type],
      points: this.points,
      type: this.type
    };
  }
  
  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
  }
}

export class InvaderGrid {
  constructor(config, scene, game) {
    this.config = config;
    this.scene = scene;
    this.game = game;
    
    this.invaders = [];
    this.gridOffsetX = 0;
    this.gridDirection = 1; // 1 = right, -1 = left
    
    // Movement state
    this.baseSpeed = CONFIG.baseGridSpeed;
    this.currentSpeed = this.baseSpeed;
    this.moveTimer = 0;
    
    // Formation dimensions
    this.rows = CONFIG.invaderRows;
    this.cols = CONFIG.invaderCols;
    
    // Track which invaders are alive per column for shooting logic
    this.alivePerColumn = [];
    
    // Shooting state
    this.shootTimer = 0;
    this.shootInterval = 1.5;
  }
  
  spawnWave(waveNumber = 1) {
    // Clean up any existing invaders first
    for (const invader of this.invaders) {
      if (invader.mesh.parent) {
        this.scene.remove(invader.mesh);
      }
      invader.dispose();
    }
    
    this.invaders = [];
    this.gridOffsetX = 0;
    this.gridDirection = 1;
    
    const typeOrder = ['squid', 'crab', 'octopus', 'octopus', 'octopus'];
    const startY = CONFIG.screenHeight / 2 - 80; // Start near top
    
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const type = typeOrder[row];
        const invader = new Invader(type, row, col, 0, startY);
        this.invaders.push(invader);
        this.scene.add(invader.mesh);
      }
    }
    
    // Initialize alive tracking per column
    for (let col = 0; col < this.cols; col++) {
      this.alivePerColumn[col] = [];
      for (let row = 0; row < this.rows; row++) {
        const invader = this.invaders[row * this.cols + col];
        if (invader.isAlive) {
          this.alivePerColumn[col].push(invader);
        }
      }
    }
    
    // Calculate initial bounds
    this.leftBound = -CONFIG.screenWidth / 2 + CONFIG.gridPaddingX;
    this.rightBound = CONFIG.screenWidth / 2 - CONFIG.gridPaddingX;
    
    // Increase speed based on wave number
    this.baseSpeed = CONFIG.baseGridSpeed * (1 + (waveNumber - 1) * 0.15);
  }
  
  update(deltaTime, playerY = -CONFIG.screenHeight / 2 + 40) {
    // Calculate speed based on remaining invaders
    const aliveCount = this.getAliveCount();
    if (aliveCount === 0) return null;
    
    // Speed increases as invaders die
    const initialCount = this.rows * this.cols;
    const speedMultiplier = Math.min(1 + (initialCount - aliveCount) / initialCount * CONFIG.speedBoostFactor, CONFIG.maxSpeedMultiplier);
    this.currentSpeed = this.baseSpeed * speedMultiplier;
    
    // Move the grid
    const moveAmount = this.currentSpeed * deltaTime * this.gridDirection;
    this.gridOffsetX += moveAmount;
    
    // Check bounds and step down if needed
    const currentLeft = this.leftBound + this.gridOffsetX;
    const currentRight = this.rightBound + this.gridOffsetX;
    const screenLeft = -CONFIG.screenWidth / 2 + CONFIG.borderPadding || 50;
    const screenRight = CONFIG.screenWidth / 2 - (CONFIG.borderPadding || 50);
    
    if (currentLeft < screenLeft || currentRight > screenRight) {
      // Step down and reverse direction
      this.gridDirection *= -1;
      const stepDownAmount = CONFIG.stepDownAmount;
      
      // Move all invaders down
      for (const invader of this.invaders) {
        if (invader.isAlive) {
          invader.localY -= stepDownAmount;
        }
      }
      
      // Check if invaders reached the floor (game over condition)
      const lowestInvader = Math.max(...this.invaders.filter(i => i.isAlive).map(i => i.localY));
      if (lowestInvader >= playerY + 30) {
        return { gameOver: true, reason: 'invaders_reached_floor' };
      }
    }
    
    // Update all invaders and collect hitboxes
    const hitboxes = [];
    for (const invader of this.invaders) {
      if (invader.isAlive) {
        const hitbox = invader.update(deltaTime, this.gridOffsetX);
        if (hitbox) hitboxes.push(hitbox);
      }
    }
    
    // Handle enemy shooting
    this.handleShooting(deltaTime);
    
    return { hitboxes, aliveCount };
  }
  
  handleShooting(deltaTime) {
    this.shootTimer += deltaTime;
    
    // Shooting becomes more frequent as fewer invaders remain
    const aliveCount = this.getAliveCount();
    const initialCount = this.rows * this.cols;
    const difficultyFactor = (initialCount - aliveCount) / initialCount;
    const currentInterval = Math.max(0.3, 1.5 - difficultyFactor * 1.2);
    
    if (this.shootTimer >= currentInterval) {
      this.shootTimer = 0;
      
      // Pick a random column with alive invaders
      const columnsWithInvaders = [];
      for (let col = 0; col < this.cols; col++) {
        if (this.alivePerColumn[col] && this.alivePerColumn[col].length > 0) {
          columnsWithInvaders.push(col);
        }
      }
      
      if (columnsWithInvaders.length > 0) {
        const randomCol = columnsWithInvaders[Math.floor(Math.random() * columnsWithInvaders.length)];
        const shooter = this.getShooterForColumn(randomCol);
        
        if (shooter && this.game?.projectileManager) {
          // Spawn enemy bullet at invader position
          const bulletPos = new THREE.Vector3(
            shooter.mesh.position.x,
            shooter.mesh.position.y - 10,
            0
          );
          this.game.projectileManager.spawnEnemyBullet(bulletPos);
        }
      }
    }
  }
  
  getShooterForColumn(colIndex) {
    // Get the bottom-most alive invader in a column
    const columnInvaders = this.alivePerColumn[colIndex] || [];
    if (columnInvaders.length === 0) return null;
    
    // Sort by Y position (highest first, which is lowest on screen)
    columnInvaders.sort((a, b) => b.localY - a.localY);
    return columnInvaders[0];
  }
  
  getAliveCount() {
    return this.invaders.filter(i => i.isAlive).length;
  }
  
  isWaveComplete() {
    return this.getAliveCount() === 0;
  }
  
  cleanup() {
    for (const invader of this.invaders) {
      if (invader.mesh.parent) {
        this.scene.remove(invader.mesh);
      }
      invader.dispose();
    }
    this.invaders = [];
  }
}
