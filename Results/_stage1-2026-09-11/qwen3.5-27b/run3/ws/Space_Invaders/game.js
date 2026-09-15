import { PlayerShip } from './entities/player.js';
import { AlienGrid } from './entities/alienGrid.js';
import { ProjectilePool } from './entities/projectile.js';
import { UFOBoss } from './entities/ufo.js';
import { PowerUpManager } from './entities/powerup.js';
import { CollisionSystem } from './systems/collision.js';
import { ScoringSystem } from './systems/scoring.js';
import { DifficultyManager } from './systems/difficulty.js';
import { UIManager } from './ui/index.js';

export class Game {
  constructor() {
    this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER, VICTORY
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    
    // Time management with hit-stop support
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.fixedDeltaTime = 1 / 60;
    this.timeScale = 1.0;
    
    // Game entities (lazy-initialized)
    this.player = null;
    this.alienGrid = null;
    this.projectilePool = null;
    this.ufo = null;
    this.powerUpManager = null;
    
    // Systems
    this.collisionSystem = new CollisionSystem();
    this.scoringSystem = new ScoringSystem();
    this.difficultyManager = new DifficultyManager();
    
    // UI Manager (initialized in init())
    this.uiManager = null;
    
    // External dependencies set after construction
    this.vfx = null;
    this.audio = null;
    this.inputController = null;
  }

  async init(scene, camera, renderer, inputController, vfxSystems, audio) {
    // Store references
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.vfx = vfxSystems;
    this.audio = audio;
    this.inputController = inputController;
    
    // Initialize UI first (needs to create overlays before game starts)
    this.uiManager = new UIManager(this);
    
    // Wait for user interaction to enable audio context
    await this.waitForUserGesture(audio);
    
    // Initialize game entities
    this.player = new PlayerShip(scene, camera, vfxSystems, audio.synth);
    this.alienGrid = new AlienGrid(scene, vfxSystems, audio.synth);
    this.projectilePool = new ProjectilePool(scene, 50, 30);
    this.ufo = new UFOBoss(scene, vfxSystems, audio.synth);
    this.powerUpManager = new PowerUpManager(scene, camera, vfxSystems, audio.synth);
    
    // Set initial wave difficulty
    this.difficultyManager.setWave(this.wave);
    
    // Start the game loop
    this.gameLoop = this.loop.bind(this);
    requestAnimationFrame(this.gameLoop);
  }

  async waitForUserGesture(audio) {
    return new Promise((resolve) => {
      const handleInteraction = async () => {
        await audio.mixer.init();
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);
        resolve();
      };
      
      document.addEventListener('click', handleInteraction);
      document.addEventListener('keydown', handleInteraction);
    });
  }

  loop(currentTime) {
    if (this.state !== 'PLAYING') {
      // Still render for menu animations, but don't update game logic
      this.render();
      requestAnimationFrame(this.gameLoop);
      return;
    }

    const rawDeltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    // Apply time scale for hit-stop effect
    const deltaTime = rawDeltaTime * this.timeScale;
    
    // Cap delta time to prevent spiral of death
    const cappedDelta = Math.min(deltaTime, 0.1);
    
    // Fixed timestep accumulator for physics consistency
    this.accumulator += cappedDelta;
    
    while (this.accumulator >= this.fixedDeltaTime) {
      this.update(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
    }
    
    // Render with interpolation factor
    const alpha = this.accumulator / this.fixedDeltaTime;
    this.render(alpha);
    
    requestAnimationFrame(this.gameLoop);
  }

  update(dt) {
    // Update player movement and shooting
    this.player.update(dt, this.inputController);
    
    // Update alien grid (movement, AI decisions)
    const gridUpdateResult = this.alienGrid.update(dt, this.difficultyManager.getSpeedMultiplier());
    
    // Check for wave completion or game over from aliens reaching bottom
    if (gridUpdateResult.allDead) {
      this.handleWaveComplete();
      return;
    }
    
    if (gridUpdateResult.reachedBottom) {
      this.handlePlayerDeath('aliens_reached_bottom');
      return;
    }
    
    // Update projectiles
    this.projectilePool.update(dt);
    
    // Update UFO
    this.ufo.update(dt, this.difficultyManager.getUFOInterval());
    
    // Update power-ups
    this.powerUpManager.update(dt);
    
    // Run collision detection
    this.runCollisions();
    
    // Check game over condition
    if (this.lives <= 0 && !this.player.isInvulnerable) {
      this.handleGameOver();
    }
  }

  runCollisions() {
    const playerProjectiles = this.projectilePool.getPlayerProjectiles();
    const enemyBombs = this.projectilePool.getEnemyBombs();
    
    // Player projectiles vs aliens
    for (const projectile of playerProjectiles) {
      if (!projectile.active) continue;
      
      // Check against all alive aliens
      const hitAlien = this.alienGrid.checkCollision(projectile);
      if (hitAlien) {
        projectile.destroy();
        this.handleAlienHit(hitAlien, projectile);
        continue;
      }
      
      // Check against UFO
      if (this.ufo.active && this.collisionSystem.sphereAABB(
        new THREE.Vector3(projectile.mesh.position.x, projectile.mesh.position.y, 0),
        0.15,
        this.ufo.getBoundingBox()
      )) {
        projectile.destroy();
        this.handleUFODestroyed(projectile);
        continue;
      }
      
      // Check against power-ups
      const hitPowerUp = this.powerUpManager.checkCollision(projectile);
      if (hitPowerUp) {
        projectile.destroy();
        this.handlePowerUpCollected(hitPowerUp, projectile);
      }
    }
    
    // Enemy bombs vs player
    for (const bomb of enemyBombs) {
      if (!bomb.active) continue;
      
      const playerBox = this.player.getBoundingBox();
      if (this.collisionSystem.sphereAABB(
        new THREE.Vector3(bomb.mesh.position.x, bomb.mesh.position.y, 0),
        0.15,
        playerBox
      )) {
        bomb.destroy();
        this.handlePlayerHitByBomb(bomb);
      }
    }
    
    // Power-ups vs player
    const powerUpCollected = this.powerUpManager.checkPlayerCollision(this.player.getBoundingBox());
    if (powerUpCollected) {
      this.applyPowerUp(powerUpCollected);
    }
  }

  handleAlienHit(alien, projectile) {
    // Calculate score with combo multiplier
    const points = this.scoringSystem.addScore(alien.points * this.scoringSystem.comboMultiplier);
    
    // Trigger VFX
    alien.destroy(projectile.mesh.position);
    
    // Audio feedback
    this.audio.synth.playExplosion('small');
    
    // Update scoring system for combo tracking
    this.scoringSystem.registerKill();
  }

  handleUFODestroyed(projectile) {
    const points = this.ufo.destroy();
    this.scoringSystem.addScore(points);
    this.audio.synth.playExplosion('large');
    
    // Chance to drop power-up
    if (Math.random() < 0.4) {
      this.powerUpManager.spawn(this.ufo.mesh.position.clone());
    }
  }

  handlePowerUpCollected(powerUp, projectile) {
    powerUp.destroy();
    this.scoringSystem.addScore(50); // Bonus for collecting power-up while it's falling
  }

  applyPowerUp(powerUp) {
    const type = powerUp.type;
    
    switch (type) {
      case 'spread':
        this.player.setWeaponType('spread');
        break;
      case 'shield':
        this.player.activateShield();
        break;
      case 'rapidfire':
        this.player.setFireRate(0.15); // Faster fire rate
        break;
    }
    
    this.audio.synth.playPowerUp();
  }

  handlePlayerHitByBomb(bomb) {
    if (this.player.isInvulnerable) return;
    
    this.lives--;
    this.scoringSystem.resetCombo();
    
    // Trigger VFX and audio
    this.vfx.cameraShake.addTrauma(15);
    this.vfx.hitStop.trigger(2);
    this.vfx.particles.spawnExplosion(this.player.mesh.position, 30, 0xff0000);
    this.audio.synth.playPlayerHit();
    
    // Apply invulnerability
    this.player.setInvulnerable(2.0);
    
    // Update UI
    this.uiManager.updateLives(this.lives);
    
    if (this.lives <= 0) {
      setTimeout(() => this.handleGameOver(), 1000);
    }
  }

  handlePlayerDeath(reason) {
    this.lives = 0;
    this.scoringSystem.resetCombo();
    this.uiManager.updateLives(0);
    
    // Big explosion at player position
    this.vfx.particles.spawnExplosion(this.player.mesh.position, 50, 0xff0000);
    this.vfx.cameraShake.addTrauma(20);
    this.vfx.hitStop.trigger(3);
    this.audio.synth.playPlayerHit();
    
    setTimeout(() => this.handleGameOver(), 1000);
  }

  handleWaveComplete() {
    // Calculate wave bonus based on remaining aliens (none in this case)
    const waveBonus = this.wave * 100;
    this.scoringSystem.addScore(waveBonus, true); // true = isBonus
    
    // Show victory text for the wave
    this.vfx.floatingText.spawn3D(
      new THREE.Vector3(0, 2, 0),
      `WAVE ${this.wave} COMPLETE!`,
      '#00ff00',
      36
    );
    
    // Brief pause before next wave
    this.state = 'VICTORY';
    this.uiManager.showWaveComplete(this.score, () => {
      this.startNextWave();
    });
  }

  startNextWave() {
    this.wave++;
    this.difficultyManager.setWave(this.wave);
    
    // Reset player position but keep power-ups
    this.player.resetPosition();
    
    // Respawn alien grid with increased difficulty
    this.alienGrid.respawn(this.wave);
    
    // Clear remaining projectiles
    this.projectilePool.clear();
    
    // Reset UFO timer
    this.ufo.reset();
    
    // Clear power-ups
    this.powerUpManager.clear();
    
    // Resume game
    this.state = 'PLAYING';
    this.uiManager.hideWaveComplete();
  }

  handleGameOver() {
    this.state = 'GAMEOVER';
    this.audio.music.stop();
    this.audio.synth.playGameOver();
    
    const finalScore = this.scoringSystem.getFinalScore();
    this.uiManager.showGameOver(finalScore, () => {
      this.resetGame();
    });
  }

  resetGame() {
    // Reset game state
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    
    // Reset scoring system
    this.scoringSystem.reset();
    
    // Reset difficulty
    this.difficultyManager.setWave(1);
    
    // Clear and respawn entities
    this.projectilePool.clear();
    this.ufo.reset();
    this.powerUpManager.clear();
    
    // Reset player
    this.player.reset();
    
    // Respawn aliens
    this.alienGrid.respawn(1);
    
    // Restart music
    this.audio.music.start(this.wave);
    
    // Return to menu or start playing
    this.state = 'PLAYING';
    this.uiManager.hideGameOver();
  }

  startGame() {
    this.resetGame();
    this.state = 'PLAYING';
    this.uiManager.hideMenu();
    this.audio.music.start(this.wave);
  }

  pauseGame() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.uiManager.showPause();
      this.audio.music.pause();
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.uiManager.hidePause();
      this.audio.music.resume();
    }
  }

  returnToMenu() {
    this.state = 'MENU';
    this.audio.music.stop();
    this.uiManager.showMenu();
  }

  render(alpha = 0) {
    // Render is handled by the main renderer in index.js
    // This method exists for potential future interpolation rendering
  }

  // Public getters for UI and other systems
  getScore() {
    return this.scoringSystem.getScore();
  }

  getComboMultiplier() {
    return this.scoringSystem.comboMultiplier;
  }

  getCurrentWave() {
    return this.wave;
  }

  destroy() {
    // Cleanup game resources
    if (this.player) this.player.destroy();
    if (this.alienGrid) this.alienGrid.destroy();
    if (this.projectilePool) this.projectilePool.destroy();
    if (this.ufo) this.ufo.destroy();
    if (this.powerUpManager) this.powerUpManager.destroy();
    
    // Stop game loop
    cancelAnimationFrame(this.gameLoop);
  }
}
