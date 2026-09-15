import { checkAABB2D, checkSphereCollision } from '../../shared/math.js';

/**
 * Collision System for Space Invaders
 * Handles all entity-to-entity collision detection with proper categorization
 */
export class CollisionSystem {
  constructor() {
    this.playerHitbox = null;
    this.projectiles = []; // Player projectiles
    this.bombs = [];       // Enemy bombs
    this.aliens = [];      // Active aliens for collision checks
    this.powerUps = [];    // Power-up entities
    this.ufo = null;       // UFO entity if active
    
    // Pre-allocate hitbox objects to avoid allocation during gameplay
    this.tempHitbox1 = { x: 0, y: 0, width: 0, height: 0 };
    this.tempHitbox2 = { x: 0, y: 0, width: 0, height: 0 };
    
    // Collision results cache
    this.results = {
      playerProjectilesHitAlien: [],
      bombsHitPlayer: false,
      powerUpsCollected: [],
      ufoHit: false
    };
  }

  /**
   * Initialize collision system with current game state
   */
  initialize(player, projectiles, bombs, aliens, powerUps, ufo) {
    this.playerHitbox = player.getHitbox();
    this.projectiles = projectiles;
    this.bombs = bombs;
    this.aliens = aliens;
    this.powerUps = powerUps;
    this.ufo = ufo;
    
    // Clear results from previous frame
    this.results = {
      playerProjectilesHitAlien: [],
      bombsHitPlayer: false,
      powerUpsCollected: [],
      ufoHit: false
    };
  }

  /**
   * Run all collision checks for the current frame
   * Returns results object with categorized collisions
   */
  update() {
    this.checkProjectileVsAliens();
    this.checkBombsVsPlayer();
    this.checkPowerUpsVsPlayer();
    this.checkUFOVsProjectiles();
    
    return this.results;
  }

  /**
   * Check player projectiles against all aliens
   */
  checkProjectileVsAliens() {
    const hits = [];
    
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      if (!projectile.active) continue;
      
      const projHitbox = projectile.getHitbox();
      let hitIndex = -1;
      
      // Check against all active aliens
      for (let j = this.aliens.length - 1; j >= 0; j--) {
        const alien = this.aliens[j];
        if (!alien.active) continue;
        
        const alienHitbox = alien.getHitbox();
        
        if (this.aabbCollides(projHitbox, alienHitbox)) {
          hitIndex = j;
          break;
        }
      }
      
      // If projectile hit an alien, record it
      if (hitIndex >= 0) {
        hits.push({
          projectile: projectile,
          alien: this.aliens[hitIndex],
          impactVelocity: projectile.velocity.y
        });
        
        // Mark projectile as destroyed
        projectile.active = false;
      }
    }
    
    this.results.playerProjectilesHitAlien = hits;
  }

  /**
   * Check enemy bombs against player
   */
  checkBombsVsPlayer() {
    let hit = false;
    
    if (!this.playerHitbox || !this.playerHitbox.active) return;
    
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      if (!bomb.active) continue;
      
      const bombHitbox = bomb.getHitbox();
      
      if (this.aabbCollides(bombHitbox, this.playerHitbox)) {
        hit = true;
        // Mark bomb as destroyed on impact
        bomb.active = false;
        break;
      }
    }
    
    this.results.bombsHitPlayer = hit;
  }

  /**
   * Check power-ups against player
   */
  checkPowerUpsVsPlayer() {
    const collected = [];
    
    if (!this.playerHitbox || !this.playerHitbox.active) return;
    
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      if (!powerUp.active) continue;
      
      const puHitbox = powerUp.getHitbox();
      
      if (this.aabbCollides(puHitbox, this.playerHitbox)) {
        collected.push(powerUp);
        powerUp.active = false;
      }
    }
    
    this.results.powerUpsCollected = collected;
  }

  /**
   * Check UFO against player projectiles
   */
  checkUFOVsProjectiles() {
    if (!this.ufo || !this.ufo.active) return;
    
    const ufoHitbox = this.ufo.getHitbox();
    
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      if (!projectile.active) continue;
      
      const projHitbox = projectile.getHitbox();
      
      if (this.aabbCollides(projHitbox, ufoHitbox)) {
        this.results.ufoHit = true;
        projectile.active = false;
        break;
      }
    }
  }

  /**
   * AABB collision check helper
   */
  aabbCollides(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /**
   * Get the list of aliens that were hit by projectiles this frame
   */
  getHitAliens() {
    return this.results.playerProjectilesHitAlien.map(hit => hit.alien);
  }

  /**
   * Get the list of projectiles that destroyed aliens (for cleanup)
   */
  getDestroyedProjectiles() {
    return this.results.playerProjectilesHitAlien.map(hit => hit.projectile);
  }

  /**
   * Check if player was hit by a bomb
   */
  isPlayerHit() {
    return this.results.bombsHitPlayer;
  }

  /**
   * Get collected power-ups
   */
  getCollectedPowerUps() {
    return this.results.powerUpsCollected;
  }

  /**
   * Check if UFO was destroyed
   */
  isUFODestroyed() {
    return this.results.ufoHit;
  }

  /**
   * Get impact velocities for VFX feedback (camera shake, hit-stop)
   */
  getImpactVelocities() {
    return this.results.playerProjectilesHitAlien.map(hit => hit.impactVelocity);
  }
}

export default CollisionSystem;
