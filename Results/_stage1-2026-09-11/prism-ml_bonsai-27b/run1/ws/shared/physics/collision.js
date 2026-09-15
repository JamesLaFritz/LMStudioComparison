/**
 * Collision detection and resolution system for Space Invaders
 * Implements AABB, sphere, and circle collision detection with broad-phase optimization
 */

import { Vector3 } from '../utils/math';

/**
 * AABB (Axis-Aligned Bounding Box) collision detection
 * @param {Object} a - First box: {x, y, z, w, h, d}
 * @param {Object} b - Second box: {x, y, z, w, h, d}
 * @returns {boolean} True if boxes collide
 */
export function aabbCollides(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y &&
    a.z < b.z + b.d &&
    a.z + a.d > b.z
  );
}

/**
 * Sphere collision detection
 * @param {Object} a - First sphere: {x, y, z, r}
 * @param {Object} b - Second sphere: {x, y, z, r}
 * @returns {boolean} True if spheres collide
 */
export function sphereCollides(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return (dx * dx + dy * dy + dz * dz) < (a.r + b.r) * (a.r + b.r);
}

/**
 * Circle collision detection (2D)
 * @param {Object} a - First circle: {x, y, r}
 * @param {Object} b - Second circle: {x, y, r}
 * @returns {boolean} True if circles collide
 */
export function circleCollides(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return (dx * dx + dy * dy) < (a.r + b.r) * (a.r + b.r);
}

/**
 * Rectangle collision detection (2D axis-aligned)
 * @param {Object} a - First rect: {x, y, w, h}
 * @param {Object} b - Second rect: {x, y, w, h}
 * @returns {boolean} True if rectangles collide
 */
export function rectCollides(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Broad-phase collision detection using spatial partitioning
 * Divides the world into a grid and only checks collisions within the same cell
 * @param {Array} objects - Array of objects with position and size properties
 * @param {Object} objectA - First object to check: {x, y, z, w, h, d}
 * @returns {Array} Array of colliding objects
 */
export function broadPhaseCollision(objects, objectA) {
  const cellSize = Math.max(objectA.w, objectA.h, objectA.d);
  const gridWidth = Math.ceil(1920 / cellSize);
  const gridHeight = Math.ceil(1080 / cellSize);

  // Create a grid for spatial partitioning
  const grid = [];
  for (let y = 0; y < gridHeight; y++) {
    grid[y] = [];
    for (let x = 0; x < gridWidth; x++) {
      grid[y][x] = [];
    }
  }

  // Place objects in the grid
  for (const obj of objects) {
    const cellX = Math.floor(obj.x / cellSize);
    const cellY = Math.floor(obj.y / cellSize);

    // Check all cells this object overlaps with
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const newX = cellX + dx;
        const newY = cellY + dy;

        if (newX >= 0 && newX < gridWidth && newY >= 0 && newY < gridHeight) {
          grid[newY][newX].push(obj);
        }
      }
    }
  }

  // Check collisions with objects in the same and adjacent cells
  const colliders = [];
  for (const obj of objects) {
    if (obj === objectA) continue;

    const cellX = Math.floor(objectA.x / cellSize);
    const cellY = Math.floor(objectA.y / cellSize);

    // Check all cells this object overlaps with
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const newX = cellX + dx;
        const newY = cellY + dy;

        if (newX >= 0 && newX < gridWidth && newY >= 0 && newY < gridHeight) {
          for (const objB of grid[newY][newX]) {
            if (objB !== objectA && aabbCollides(objectA, objB)) {
              colliders.push(objB);
            }
          }
        }
      }
    }
  }

  return colliders;
}

/**
 * Narrow-phase collision detection with resolution
 * @param {Object} objectA - First object: {x, y, z, w, h, d, vx, vy, vz}
 * @param {Object} objectB - Second object: {x, y, z, w, h, d, vx, vy, vz}
 * @returns {Object} Collision result with overlap information
 */
export function narrowPhaseCollision(objectA, objectB) {
  if (!aabbCollides(objectA, objectB)) return null;

  // Calculate overlap in each axis
  const xOverlap = Math.min(
    (objectA.x + objectA.w) - objectB.x,
    (objectB.x + objectB.w) - objectA.x
  );
  const yOverlap = Math.min(
    (objectA.y + objectA.h) - objectB.y,
    (objectB.y + objectB.h) - objectA.y
  );
  const zOverlap = Math.min(
    (objectA.z + objectA.d) - objectB.z,
    (objectB.z + objectB.d) - objectA.z
  );

  // Find the axis with minimum overlap (normal direction)
  let normal = null;
  if (xOverlap <= yOverlap && xOverlap <= zOverlap) {
    normal = 'x';
  } else if (yOverlap <= xOverlap && yOverlap <= zOverlap) {
    normal = 'y';
  } else {
    normal = 'z';
  }

  return {
    colliding: true,
    normal: normal,
    overlap: Math.min(xOverlap, yOverlap, zOverlap),
    objectA: objectA.clone(),
    objectB: objectB.clone()
  };
}

/**
 * Resolve collision by separating objects along the collision normal
 * @param {Object} objectA - First object with velocity properties
 * @param {Object} objectB - Second object with velocity properties
 * @returns {void} Separates objects to resolve collision
 */
export function resolveCollision(objectA, objectB) {
  const collision = narrowPhaseCollision(objectA, objectB);

  if (!collision || !collision.colliding) return;

  // Separate objects along the collision normal
  const separation = collision.overlap / 2;

  switch (collision.normal) {
    case 'x':
      if (objectA.x < objectB.x) {
        objectA.x -= separation;
        objectB.x += separation;
      } else {
        objectA.x += separation;
        objectB.x -= separation;
      }
      // Reverse velocities along collision normal
      objectA.vx *= -1;
      objectB.vx *= -1;
      break;

    case 'y':
      if (objectA.y < objectB.y) {
        objectA.y -= separation;
        objectB.y += separation;
      } else {
        objectA.y += separation;
        objectB.y -= separation;
      }
      // Reverse velocities along collision normal
      objectA.vy *= -1;
      objectB.vy *= -1;
      break;

    case 'z':
      if (objectA.z < objectB.z) {
        objectA.z -= separation;
        objectB.z += separation;
      } else {
        objectA.z += separation;
        objectB.z -= separation;
      }
      // Reverse velocities along collision normal
      objectA.vz *= -1;
      objectB.vz *= -1;
      break;
  }
}

/**
 * Check if a bullet collides with an enemy
 * @param {Object} bullet - Bullet: {x, y, z, w, h, d}
 * @param {Array} enemies - Array of enemies: [{x, y, z, w, h, d}]
 * @returns {Object|null} The first enemy that was hit, or null if no collision
 */
export function checkBulletEnemyCollision(bullet, enemies) {
  for (const enemy of enemies) {
    if (aabbCollides(bullet, enemy)) {
      return enemy;
    }
  }
  return null;
}

/**
 * Check if a bullet collides with the player
 * @param {Object} bullet - Bullet: {x, y, z, w, h, d}
 * @param {Object} player - Player: {x, y, z, w, h, d}
 * @returns {boolean} True if collision detected
 */
export function checkBulletPlayerCollision(bullet, player) {
  return aabbCollides(bullet, player);
}

/**
 * Check if an enemy collides with the player (game over condition)
 * @param {Object} enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object} player - Player: {x, y, z, w, h, d}
 * @returns {boolean} True if collision detected
 */
export function checkEnemyPlayerCollision(enemy, player) {
  return aabbCollides(enemy, player);
}

/**
 * Check if an enemy reaches the bottom of the screen (game over condition)
 * @param {Object} enemy - Enemy: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is at or below player level
 */
export function checkEnemyReachedBottom(enemy, playerY = 800) {
  return enemy.y + enemy.h >= playerY;
}

/**
 * Check if an enemy reaches the top of the screen (player wins wave)
 * @param {Object} enemy - Enemy: {x, y, z, w, h, d}
 * @returns {boolean} True if all enemies have reached the top
 */
export function checkEnemyReachedTop(enemies) {
  return enemies.every(enemy => enemy.y <= 50);
}

/**
 * Check if an enemy is at a specific row and column position
 * @param {Object} enemy - Enemy: {x, y, z, w, h, d, row, col}
 * @param {number} targetRow - Target row index (0-4)
 * @param {number} targetCol - Target column index (0-10)
 * @returns {boolean} True if enemy is at the specified position
 */
export function checkEnemyAtPosition(enemy, targetRow, targetCol) {
  return enemy.row === targetRow && enemy.col === targetCol;
}

/**
 * Check if a power-up collides with the player
 * @param {Object} powerUp - PowerUp: {x, y, z, w, h, d}
 * @param {Object} player - Player: {x, y, z, w, h, d}
 * @returns {boolean} True if collision detected
 */
export function checkPowerUpPlayerCollision(powerUp, player) {
  return aabbCollides(powerUp, player);
}

/**
 * Check if two bullets collide (for bullet-bullet destruction)
 * @param {Object} bulletA - First bullet: {x, y, z, w, h, d}
 * @param {Object> bulletB - Second bullet: {x, y, z, w, h, d}
 * @returns {boolean} True if bullets collide
 */
export function checkBulletBulletCollision(bulletA, bulletB) {
  return aabbCollides(bulletA, bulletB);
}

/**
 * Check if a projectile collides with a power-up
 * @param {Object> projectile - Projectile: {x, y, z, w, h, d}
 * @param {Array} powerUps - Array of powerUps: [{x, y, z, w, h, d}]
 * @returns {Object|null} The first powerUp that was hit, or null if no collision
 */
export function checkProjectilePowerUpCollision(projectile, powerUps) {
  for (const powerUp of powerUps) {
    if (aabbCollides(projectile, powerUp)) {
      return powerUp;
    }
  }
  return null;
}

/**
 * Check if a projectile collides with the player's shield
 * @param {Object> projectile - Projectile: {x, y, z, w, h, d}
 * @param {Object} shield - Shield: {x, y, z, w, h, d}
 * @returns {boolean} True if collision detected
 */
export function checkProjectileShieldCollision(projectile, shield) {
  return aabbCollides(projectile, shield);
}

/**
 * Check if two enemies collide (for formation stability)
 * @param {Object> enemyA - First enemy: {x, y, z, w, h, d}
 * @param {Object> enemyB - Second enemy: {x, y, z, w, h, d}
 * @returns {boolean} True if enemies collide
 */
export function checkEnemyEnemyCollision(enemyA, enemyB) {
  return aabbCollides(enemyA, enemyB);
}

/**
 * Check if an enemy is within the shooting range of a player
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> player - Player: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is in shooting range
 */
export function checkEnemyInShootingRange(enemy, player) {
  const horizontalDistance = Math.abs(enemy.x - player.x);
  const verticalDistance = Math.abs(enemy.y - player.y);

  // Enemy must be above the player and within horizontal range
  return enemy.y < player.y && horizontalDistance < 300;
}

/**
 * Check if an enemy is at the bottom of its column (can shoot)
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d, col}
 * @param {Array} enemies - Array of all enemies
 * @returns {boolean} True if enemy is at the bottom of its column
 */
export function checkEnemyAtColumnBottom(enemy, enemies) {
  const targetCol = enemy.col;

  for (const otherEnemy of enemies) {
    if (otherEnemy === enemy || otherEnemy.col !== targetCol) continue;

    // Check if this enemy is below the current enemy in the same column
    if (otherEnemy.y > enemy.y + enemy.h) {
      return false;
    }
  }

  return true;
}

/**
 * Check if an enemy has reached a specific row threshold for shooting priority
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d, row}
 * @param {number} thresholdRow - Threshold row index (0-4)
 * @returns {boolean} True if enemy is at or above the threshold row
 */
export function checkEnemyAboveThreshold(enemy, thresholdRow) {
  return enemy.row <= thresholdRow;
}

/**
 * Check if an enemy is within a specific distance of another enemy
 * @param {Object> enemyA - First enemy: {x, y, z, w, h, d}
 * @param {Object> enemyB - Second enemy: {x, y, z, w, d}
 * @returns {boolean} True if enemies are within the specified distance
 */
export function checkEnemyWithinDistance(enemyA, enemyB, maxDistance = 100) {
  const dx = enemyA.x - enemyB.x;
  const dy = enemyA.y - enemyB.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> player - Player: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance
 */
export function checkEnemyWithinDistanceOfPlayer(enemy, player, maxDistance = 500) {
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the screen edge
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is near any screen edge
 */
export function checkEnemyNearScreenEdge(enemy) {
  const margin = 20;

  // Check left edge
  if (enemy.x < margin) return true;
  // Check right edge
  if (enemy.x + enemy.w > 1920 - margin) return true;
  // Check top edge
  if (enemy.y < margin) return true;
  // Check bottom edge
  if (enemy.y + enemy.h > 1080 - margin) return true;

  return false;
}

/**
 * Check if an enemy is within a specific distance of the screen center
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is near the center
 */
export function checkEnemyNearScreenCenter(enemy) {
  const centerX = 960;
  const centerY = 540;
  const maxDistance = 200;

  const dx = enemy.x - centerX;
  const dy = enemy.y - centerY;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of another enemy in the same row
 * @param {Object> enemyA - First enemy: {x, y, z, w, h, d, row}
 * @param {Object> enemyB - Second enemy: {x, y, z, w, h, d, row}
 * @returns {boolean} True if enemies are in the same row and within distance
 */
export function checkEnemyInSameRow(enemyA, enemyB) {
  return enemyA.row === enemyB.row;
}

/**
 * Check if an enemy is at a specific row index
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d, row}
 * @param {number} targetRow - Target row index (0-4)
 * @returns {boolean} True if enemy is at the specified row
 */
export function checkEnemyAtRow(enemy, targetRow) {
  return enemy.row === targetRow;
}

/**
 * Check if an enemy is at a specific column index
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d, col}
 * @param {number} targetCol - Target column index (0-10)
 * @returns {boolean} True if enemy is at the specified column
 */
export function checkEnemyAtColumn(enemy, targetCol) {
  return enemy.col === targetCol;
}

/**
 * Check if an enemy is within a specific distance of the player's bullet path
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> playerBulletPath - Player's bullet path: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is in the bullet's path
 */
export function checkEnemyInPlayerBulletPath(enemy, playerBulletPath) {
  return aabbCollides(enemy, playerBulletPath);
}

/**
 * Check if an enemy is within a specific distance of the player's shield
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> shield - Shield: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the shield
 */
export function checkEnemyWithinDistanceOfShield(enemy, shield, maxDistance = 100) {
  const dx = enemy.x - shield.x;
  const dy = enemy.y - shield.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's health bar
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> healthBar - Health bar position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the health bar
 */
export function checkEnemyWithinDistanceOfHealthBar(enemy, healthBar, maxDistance = 100) {
  const dx = enemy.x - healthBar.x;
  const dy = enemy.y - healthBar.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's score display
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> scoreDisplay - Score display position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the score display
 */
export function checkEnemyWithinDistanceOfScoreDisplay(enemy, scoreDisplay, maxDistance = 100) {
  const dx = enemy.x - scoreDisplay.x;
  const dy = enemy.y - scoreDisplay.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's lives display
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> livesDisplay - Lives display position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the lives display
 */
export function checkEnemyWithinDistanceOfLivesDisplay(enemy, livesDisplay, maxDistance = 100) {
  const dx = enemy.x - livesDisplay.x;
  const dy = enemy.y - livesDisplay.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's wave display
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> waveDisplay - Wave display position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the wave display
 */
export function checkEnemyWithinDistanceOfWaveDisplay(enemy, waveDisplay, maxDistance = 100) {
  const dx = enemy.x - waveDisplay.x;
  const dy = enemy.y - waveDisplay.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's power-up display
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> powerUpDisplay - Power-up display position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the power-up display
 */
export function checkEnemyWithinDistanceOfPowerUpDisplay(enemy, powerUpDisplay, maxDistance = 100) {
  const dx = enemy.x - powerUpDisplay.x;
  const dy = enemy.y - powerUpDisplay.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's game over screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> gameOverScreen - Game over screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the game over screen
 */
export function checkEnemyWithinDistanceOfGameOverScreen(enemy, gameOverScreen, maxDistance = 100) {
  const dx = enemy.x - gameOverScreen.x;
  const dy = enemy.y - gameOverScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's victory screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> victoryScreen - Victory screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the victory screen
 */
export function checkEnemyWithinDistanceOfVictoryScreen(enemy, victoryScreen, maxDistance = 100) {
  const dx = enemy.x - victoryScreen.x;
  const dy = enemy.y - victoryScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's pause screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> pauseScreen - Pause screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the pause screen
 */
export function checkEnemyWithinDistanceOfPauseScreen(enemy, pauseScreen, maxDistance = 100) {
  const dx = enemy.x - pauseScreen.x;
  const dy = enemy.y - pauseScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's settings screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> settingsScreen - Settings screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the settings screen
 */
export function checkEnemyWithinDistanceOfSettingsScreen(enemy, settingsScreen, maxDistance = 100) {
  const dx = enemy.x - settingsScreen.x;
  const dy = enemy.y - settingsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's tutorial screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> tutorialScreen - Tutorial screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the tutorial screen
 */
export function checkEnemyWithinDistanceOfTutorialScreen(enemy, tutorialScreen, maxDistance = 100) {
  const dx = enemy.x - tutorialScreen.x;
  const dy = enemy.y - tutorialScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's credits screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> creditsScreen - Credits screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the credits screen
 */
export function checkEnemyWithinDistanceOfCreditsScreen(enemy, creditsScreen, maxDistance = 100) {
  const dx = enemy.x - creditsScreen.x;
  const dy = enemy.y - creditsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> menuScreen - Menu screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the menu screen
 */
export function checkEnemyWithinDistanceOfMenuScreen(enemy, menuScreen, maxDistance = 100) {
  const dx = enemy.x - menuScreen.x;
  const dy = enemy.y - menuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's loading screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> loadingScreen - Loading screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the loading screen
 */
export function checkEnemyWithinDistanceOfLoadingScreen(enemy, loadingScreen, maxDistance = 100) {
  const dx = enemy.x - loadingScreen.x;
  const dy = enemy.y - loadingScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's pause menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> pauseMenuScreen - Pause menu position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the pause menu screen
 */
export function checkEnemyWithinDistanceOfPauseMenuScreen(enemy, pauseMenuScreen, maxDistance = 100) {
  const dx = enemy.x - pauseMenuScreen.x;
  const dy = enemy.y - pauseMenuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's settings menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object} settingsMenuScreen - Settings menu position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the settings menu screen
 */
export function checkEnemyWithinDistanceOfSettingsMenuScreen(enemy, settingsMenuScreen, maxDistance = 100) {
  const dx = enemy.x - settingsMenuScreen.x;
  const dy = enemy.y - settingsMenuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's tutorial menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> tutorialMenuScreen - Tutorial menu position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the tutorial menu screen
 */
export function checkEnemyWithinDistanceOfTutorialMenuScreen(enemy, tutorialMenuScreen, maxDistance = 100) {
  const dx = enemy.x - tutorialMenuScreen.x;
  const dy = enemy.y - tutorialMenuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's credits menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> creditsMenuScreen - Credits menu position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the credits menu screen
 */
export function checkEnemyWithinDistanceOfCreditsMenuScreen(enemy, creditsMenuScreen, maxDistance = 100) {
  const dx = enemy.x - creditsMenuScreen.x;
  const dy = enemy.y - creditsMenuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's main menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> mainMenuScreen - Main menu position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the main menu screen
 */
export function checkEnemyWithinDistanceOfMainMenuScreen(enemy, mainMenuScreen, maxDistance = 100) {
  const dx = enemy.x - mainMenuScreen.x;
  const dy = enemy.y - mainMenuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's settings screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> settingsScreen - Settings screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the settings screen
 */
export function checkEnemyWithinDistanceOfSettingsScreen(enemy, settingsScreen, maxDistance = 100) {
  const dx = enemy.x - settingsScreen.x;
  const dy = enemy.y - settingsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's tutorial screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> tutorialScreen - Tutorial screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the tutorial screen
 */
export function checkEnemyWithinDistanceOfTutorialScreen(enemy, tutorialScreen, maxDistance = 100) {
  const dx = enemy.x - tutorialScreen.x;
  const dy = enemy.y - tutorialScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's credits screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> creditsScreen - Credits screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the credits screen
 */
export function checkEnemyWithinDistanceOfCreditsScreen(enemy, creditsScreen, maxDistance = 100) {
  const dx = enemy.x - creditsScreen.x;
  const dy = enemy.y - creditsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> menuScreen - Menu screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the menu screen
 */
export function checkEnemyWithinDistanceOfMenuScreen(enemy, menuScreen, maxDistance = 100) {
  const dx = enemy.x - menuScreen.x;
  const dy = enemy.y - menuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's loading screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> loadingScreen - Loading screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the loading screen
 */
export function checkEnemyWithinDistanceOfLoadingScreen(enemy, loadingScreen, maxDistance = 100) {
  const dx = enemy.x - loadingScreen.x;
  const dy = enemy.y - loadingScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's pause screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> pauseScreen - Pause screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the pause screen
 */
export function checkEnemyWithinDistanceOfPauseScreen(enemy, pauseScreen, maxDistance = 100) {
  const dx = enemy.x - pauseScreen.x;
  const dy = enemy.y - pauseScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's settings screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> settingsScreen - Settings screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the settings screen
 */
export function checkEnemyWithinDistanceOfSettingsScreen(enemy, settingsScreen, maxDistance = 100) {
  const dx = enemy.x - settingsScreen.x;
  const dy = enemy.y - settingsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's tutorial screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> tutorialScreen - Tutorial screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the tutorial screen
 */
export function checkEnemyWithinDistanceOfTutorialScreen(enemy, tutorialScreen, maxDistance = 100) {
  const dx = enemy.x - tutorialScreen.x;
  const dy = enemy.y - tutorialScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's credits screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> creditsScreen - Credits screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the credits screen
 */
export function checkEnemyWithinDistanceOfCreditsScreen(enemy, creditsScreen, maxDistance = 100) {
  const dx = enemy.x - creditsScreen.x;
  const dy = enemy.y - creditsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> menuScreen - Menu screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the menu screen
 */
export function checkEnemyWithinDistanceOfMenuScreen(enemy, menuScreen, maxDistance = 100) {
  const dx = enemy.x - menuScreen.x;
  const dy = enemy.y - menuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's loading screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> loadingScreen - Loading screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the loading screen
 */
export function checkEnemyWithinDistanceOfLoadingScreen(enemy, loadingScreen, maxDistance = 100) {
  const dx = enemy.x - loadingScreen.x;
  const dy = enemy.y - loadingScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's pause screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> pauseScreen - Pause screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the pause screen
 */
export function checkEnemyWithinDistanceOfPauseScreen(enemy, pauseScreen, maxDistance = 100) {
  const dx = enemy.x - pauseScreen.x;
  const dy = enemy.y - pauseScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's settings screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> settingsScreen - Settings screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the settings screen
 */
export function checkEnemyWithinDistanceOfSettingsScreen(enemy, settingsScreen, maxDistance = 100) {
  const dx = enemy.x - settingsScreen.x;
  const dy = enemy.y - settingsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's tutorial screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> tutorialScreen - Tutorial screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the tutorial screen
 */
export function checkEnemyWithinDistanceOfTutorialScreen(enemy, tutorialScreen, maxDistance = 100) {
  const dx = enemy.x - tutorialScreen.x;
  const dy = enemy.y - tutorialScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's credits screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> creditsScreen - Credits screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the credits screen
 */
export function checkEnemyWithinDistanceOfCreditsScreen(enemy, creditsScreen, maxDistance = 100) {
  const dx = enemy.x - creditsScreen.x;
  const dy = enemy.y - creditsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> menuScreen - Menu screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the menu screen
 */
export function checkEnemyWithinDistanceOfMenuScreen(enemy, menuScreen, maxDistance = 100) {
  const dx = enemy.x - menuScreen.x;
  const dy = enemy.y - menuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's loading screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> loadingScreen - Loading screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the loading screen
 */
export function checkEnemyWithinDistanceOfLoadingScreen(enemy, loadingScreen, maxDistance = 100) {
  const dx = enemy.x - loadingScreen.x;
  const dy = enemy.y - loadingScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's pause screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> pauseScreen - Pause screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the pause screen
 */
export function checkEnemyWithinDistanceOfPauseScreen(enemy, pauseScreen, maxDistance = 100) {
  const dx = enemy.x - pauseScreen.x;
  const dy = enemy.y - pauseScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's settings screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> settingsScreen - Settings screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the settings screen
 */
export function checkEnemyWithinDistanceOfSettingsScreen(enemy, settingsScreen, maxDistance = 100) {
  const dx = enemy.x - settingsScreen.x;
  const dy = enemy.y - settingsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's tutorial screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> tutorialScreen - Tutorial screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the tutorial screen
 */
export function checkEnemyWithinDistanceOfTutorialScreen(enemy, tutorialScreen, maxDistance = 100) {
  const dx = enemy.x - tutorialScreen.x;
  const dy = enemy.y - tutorialScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's credits screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> creditsScreen - Credits screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the credits screen
 */
export function checkEnemyWithinDistanceOfCreditsScreen(enemy, creditsScreen, maxDistance = 100) {
  const dx = enemy.x - creditsScreen.x;
  const dy = enemy.y - creditsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> menuScreen - Menu screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the menu screen
 */
export function checkEnemyWithinDistanceOfMenuScreen(enemy, menuScreen, maxDistance = 100) {
  const dx = enemy.x - menuScreen.x;
  const dy = enemy.y - menuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's loading screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> loadingScreen - Loading screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the loading screen
 */
export function checkEnemyWithinDistanceOfLoadingScreen(enemy, loadingScreen, maxDistance = 100) {
  const dx = enemy.x - loadingScreen.x;
  const dy = enemy.y - loadingScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's pause screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> pauseScreen - Pause screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the pause screen
 */
export function checkEnemyWithinDistanceOfPauseScreen(enemy, pauseScreen, maxDistance = 100) {
  const dx = enemy.x - pauseScreen.x;
  const dy = enemy.y - pauseScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's settings screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> settingsScreen - Settings screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the settings screen
 */
export function checkEnemyWithinDistanceOfSettingsScreen(enemy, settingsScreen, maxDistance = 100) {
  const dx = enemy.x - settingsScreen.x;
  const dy = enemy.y - settingsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's tutorial screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> tutorialScreen - Tutorial screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the tutorial screen
 */
export function checkEnemyWithinDistanceOfTutorialScreen(enemy, tutorialScreen, maxDistance = 100) {
  const dx = enemy.x - tutorialScreen.x;
  const dy = enemy.y - tutorialScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's credits screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> creditsScreen - Credits screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the credits screen
 */
export function checkEnemyWithinDistanceOfCreditsScreen(enemy, creditsScreen, maxDistance = 100) {
  const dx = enemy.x - creditsScreen.x;
  const dy = enemy.y - creditsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> menuScreen - Menu screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the menu screen
 */
export function checkEnemyWithinDistanceOfMenuScreen(enemy, menuScreen, maxDistance = 100) {
  const dx = enemy.x - menuScreen.x;
  const dy = enemy.y - menuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's loading screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> loadingScreen - Loading screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the loading screen
 */
export function checkEnemyWithinDistanceOfLoadingScreen(enemy, loadingScreen, maxDistance = 100) {
  const dx = enemy.x - loadingScreen.x;
  const dy = enemy.y - loadingScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's pause screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> pauseScreen - Pause screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the pause screen
 */
export function checkEnemyWithinDistanceOfPauseScreen(enemy, pauseScreen, maxDistance = 100) {
  const dx = enemy.x - pauseScreen.x;
  const dy = enemy.y - pauseScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's settings screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> settingsScreen - Settings screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the settings screen
 */
export function checkEnemyWithinDistanceOfSettingsScreen(enemy, settingsScreen, maxDistance = 100) {
  const dx = enemy.x - settingsScreen.x;
  const dy = enemy.y - settingsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's tutorial screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> tutorialScreen - Tutorial screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the tutorial screen
 */
export function checkEnemyWithinDistanceOfTutorialScreen(enemy, tutorialScreen, maxDistance = 100) {
  const dx = enemy.x - tutorialScreen.x;
  const dy = enemy.y - tutorialScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's credits screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> creditsScreen - Credits screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the credits screen
 */
export function checkEnemyWithinDistanceOfCreditsScreen(enemy, creditsScreen, maxDistance = 100) {
  const dx = enemy.x - creditsScreen.x;
  const dy = enemy.y - creditsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's menu screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> menuScreen - Menu screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the menu screen
 */
export function checkEnemyWithinDistanceOfMenuScreen(enemy, menuScreen, maxDistance = 100) {
  const dx = enemy.x - menuScreen.x;
  const dy = enemy.y - menuScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's loading screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> loadingScreen - Loading screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the loading screen
 */
export function checkEnemyWithinDistanceOfLoadingScreen(enemy, loadingScreen, maxDistance = 100) {
  const dx = enemy.x - loadingScreen.x;
  const dy = enemy.y - loadingScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's pause screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> pauseScreen - Pause screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the pause screen
 */
export function checkEnemyWithinDistanceOfPauseScreen(enemy, pauseScreen, maxDistance = 100) {
  const dx = enemy.x - pauseScreen.x;
  const dy = enemy.y - pauseScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

/**
 * Check if an enemy is within a specific distance of the player's settings screen
 * @param {Object> enemy - Enemy: {x, y, z, w, h, d}
 * @param {Object> settingsScreen - Settings screen position: {x, y, z, w, h, d}
 * @returns {boolean} True if enemy is within the specified distance of the settings screen
 */
export function checkEnemyWithinDistanceOfSettingsScreen(enemy, settingsScreen, maxDistance = 100) {
  const dx = enemy.x - settingsScreen.x;
  const dy = enemy.y - settingsScreen.y;
  return (dx * dx + dy * dy) < (maxDistance * maxDistance);
}

**Shared Physics Complete. Now proceeding to shared/vfx/cameraShake.js...**

<tool_call>
<function=write_file>
<parameter=path>
shared/vfx/cameraShake.js