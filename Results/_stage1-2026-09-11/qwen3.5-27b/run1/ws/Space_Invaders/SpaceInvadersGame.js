import { CONFIG } from './config.js';
import { PlayerShip } from './entities/PlayerShip.js';
import { InvaderGrid } from './entities/InvaderGrid.js';
import { ProjectileManager } from './systems/ProjectileManager.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { ScoreManager } from './systems/ScoreManager.js';

export class SpaceInvadersGame {
  constructor() {
    this.renderer = null;
    this.camera = null;
    this.scene = null;
    this.composer = null;
    
    // Systems
    this.player = null;
    this.invaderGrid = null;
    this.projectileManager = null;
    this.collisionSystem = null;
    this.scoreManager = null;
    
    // VFX systems (injected by main.js)
    this.particleManager = null;
    this.motionTrails = null;
    this.shockwaveSystem = null;
    this.floatingText = null;
    this.cameraController = null;
    this.audioSynth = null;
    
    // Input controller (injected by main.js)
    this.inputController = null;
    
    // Game state
    this.gameState = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER, VICTORY
    this.wave = 1;
    this.lives = 3;
    
    // Resources to clean up
    this.resourcesToClean = [];
  }

  initRenderer(renderer, camera, scene, composer) {
    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;
    this.composer = composer;
  }

  initVFX(particleManager, motionTrails, shockwaveSystem, floatingText, cameraController, audioSynth) {
    this.particleManager = particleManager;
    this.motionTrails = motionTrails;
    this.shockwaveSystem = shockwaveSystem;
    this.floatingText = floatingText;
    this.cameraController = cameraController;
    this.audioSynth = audioSynth;
  }

  initInput(inputController) {
    this.inputController = inputController;
  }

  initUI(ui) {
    this.ui = ui;
    this.ui.showMenu();
  }

  async startNewGame() {
    // Clean up any existing game state
    this.cleanupGameState();
    
    // Initialize player with config and scene
    this.player = new PlayerShip(CONFIG, this.scene);
    this.resourcesToClean.push(this.player.bodyMesh.geometry, this.player.bodyMesh.material);
    this.resourcesToClean.push(this.player.engineGlow.geometry, this.player.engineGlow.material);
    this.resourcesToClean.push(this.player.shieldRing.geometry, this.player.shieldRing.material);
    
    // Initialize invader grid
    this.invaderGrid = new InvaderGrid(CONFIG, this.scene, this);
    
    // Spawn first wave of invaders
    this.invaderGrid.spawnWave(this.wave);
    
    // Initialize projectile manager
    this.projectileManager = new ProjectileManager(CONFIG, this.scene, this);
    
    // Initialize collision system
    this.collisionSystem = new CollisionSystem(this);
    
    // Initialize score manager
    this.scoreManager = new ScoreManager(this);
    
    // Reset game state
    this.gameState = 'PLAYING';
    this.lives = 3;
    
    // UI updates
    this.ui.hideMenu();
    this.ui.showHUD(this.scoreManager.score, this.lives, this.wave);
    
    // Audio
    if (this.audioSynth) {
      this.audioSynth.playStartGame();
    }
  }

  cleanupGameState() {
    // Remove player
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }
    
    // Remove invaders
    if (this.invaderGrid) {
      this.invaderGrid.cleanup();
      this.invaderGrid = null;
    }
    
    // Clear projectiles
    if (this.projectileManager) {
      this.projectileManager.clearAll();
      this.projectileManager = null;
    }
    
    // Reset collision system
    if (this.collisionSystem) {
      this.collisionSystem.reset();
      this.collisionSystem = null;
    }
  }

  update(deltaTime, inputController) {
    if (this.gameState !== 'PLAYING') return;
    
    // Update player with input
    this.player.update(deltaTime, inputController);
    
    // Handle shooting
    if (inputController.getButton('fire')) {
      this.player.tryFire(this.projectileManager);
    }
    
    // Update invader grid
    this.invaderGrid.update(deltaTime);
    
    // Update projectiles
    this.projectileManager.update(deltaTime);
    
    // Check collisions
    this.collisionSystem.checkCollisions();
    
    // Update score display
    this.ui.updateScore(this.scoreManager.score, this.scoreManager.comboMultiplier);
  }

  render() {
    if (this.gameState === 'PLAYING') {
      // Render with post-processing
      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    }
  }

  triggerHitStop(frames = 8) {
    return frames / 60; // Convert to seconds
  }

  spawnExplosion(position, color, count = 24) {
    if (this.particleManager) {
      this.particleManager.spawnBurst(position, color, count);
    }
  }

  spawnShockwave(position) {
    if (this.shockwaveSystem) {
      this.shockwaveSystem.spawn(position);
    }
  }

  showFloatingText(text, position, color = '#00ff88') {
    if (this.floatingText) {
      this.floatingText.spawn(text, position, color);
    }
  }

  addCameraShake(intensity, duration) {
    if (this.cameraController) {
      this.cameraController.addShake(intensity, duration);
    }
  }

  playSound(soundType) {
    if (this.audioSynth) {
      switch (soundType) {
        case 'shoot':
          this.audioSynth.playLaser();
          break;
        case 'explosion':
          this.audioSynth.playExplosion();
          break;
        case 'hit':
          this.audioSynth.playHit();
          break;
        case 'gameover':
          this.audioSynth.playGameOver();
          break;
        case 'victory':
          this.audioSynth.playVictory();
          break;
      }
    }
  }

  onPlayerHit() {
    this.lives--;
    this.ui.updateLives(this.lives);
    
    // VFX feedback
    const playerPos = new THREE.Vector3(0, -40, 0);
    this.spawnExplosion(playerPos, CONFIG.colors.player, 30);
    this.spawnShockwave(playerPos);
    this.addCameraShake(CONFIG.cameraShakeIntensity, 0.2);
    
    if (this.lives <= 0) {
      this.endGame(false);
    }
  }

  onInvaderKilled(invader, position) {
    // VFX feedback
    this.spawnExplosion(position, invader.color, CONFIG.particleCountPerExplosion);
    this.addCameraShake(5, 0.1);
    
    // Score update
    const points = CONFIG.points[invader.type];
    this.scoreManager.addScore(points, position);
    
    // Check for wave completion
    if (this.invaderGrid.isWaveComplete()) {
      this.nextWave();
    }
  }

  onPlayerBulletHitEnemyBullet() {
    this.scoreManager.addScore(CONFIG.points.bulletBonus);
    this.playSound('hit');
  }

  nextWave() {
    this.wave++;
    this.invaderGrid.spawnWave(this.wave);
    this.ui.updateWave(this.wave);
    
    // Increase difficulty
    if (this.audioSynth) {
      this.audioSynth.playLevelUp();
    }
  }

  endGame(victory) {
    this.gameState = victory ? 'VICTORY' : 'GAMEOVER';
    
    if (victory) {
      this.ui.showVictory(this.scoreManager.finalScore);
      this.playSound('victory');
      
      // Victory fanfare - burst particles everywhere
      for (let i = 0; i < 10; i++) {
        const x = (Math.random() - 0.5) * CONFIG.screenWidth * 0.8;
        const y = (Math.random() - 0.5) * CONFIG.screenHeight * 0.6;
        this.spawnExplosion(new THREE.Vector3(x, y, 0), 0xffffff, 20);
      }
    } else {
      this.ui.showGameOver(this.scoreManager.finalScore);
      this.playSound('gameover');
    }
  }

  togglePause() {
    if (this.gameState === 'PLAYING') {
      this.gameState = 'PAUSED';
      this.ui.showPause();
      if (this.audioSynth) {
        this.audioSynth.pauseMusic();
      }
    } else if (this.gameState === 'PAUSED') {
      this.gameState = 'PLAYING';
      this.ui.hidePause();
      if (this.audioSynth) {
        this.audioSynth.resumeMusic();
      }
    }
  }

  cleanup() {
    // Clean up Three.js resources
    for (const resource of this.resourcesToClean) {
      if (resource && typeof resource.dispose === 'function') {
        resource.dispose();
      }
    }
    this.resourcesToClean = [];
    
    // Remove all scene objects
    if (this.player?.mesh) {
      this.scene.remove(this.player.mesh);
    }
  }

  dispose() {
    this.cleanup();
  }
}
