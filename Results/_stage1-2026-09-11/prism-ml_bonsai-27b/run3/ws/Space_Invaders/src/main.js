import * as THREE from 'three';
import { GameEngine } from '../shared/core/GameEngine.js';
import { InputHandler } from '../shared/core/InputHandler.js';
import { ParticleSystem } from '../shared/vfs/ParticleSystem.js';
import { CameraShake } from '../shared/vfs/CameraShake.js';
import { HitStop } from '../shared/vfs/HitStop.js';
import { MotionTrail } from '../shared/vfs/MotionTrail.js';
import { Shockwave } from '../shared/vfs/Shockwave.js';
import { PostProcessor } from './post-processing/PostProcessor.js';
import PlayerShip from './entities/Player.js';
import AlienFormation from './entities/EnemyFormation.js';
import Projectile from './entities/Projectile.js';
import ParticleEmitter from './entities/ParticleEmitter.js';
import ScoreDisplay from './ui/ScoreDisplay.js';
import LivesDisplay from './ui/LivesDisplay.js';
import WaveIndicator from './ui/WaveIndicator.js';

class SpaceInvaders {
  constructor() {
    this.engine = new GameEngine();
    this.inputHandler = new InputHandler();
    this.particleSystem = new ParticleSystem();
    this.cameraShake = new CameraShake();
    this.hitStop = new HitStop();
    this.trailManager = new MotionTrail(15);
    this.shockwaveManager = new Shockwave();

    // Game entities
    this.player = null;
    this.alienFormation = null;
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.gameState = 'menu';

    // Game configuration
    this.playerSpeed = 5.0;
    this.bulletSpeed = 8.0;
    this.enemyBulletSpeed = 4.0;
    this.alienMovementSpeed = 2.0;
    this.alienDropDistance = 10.0;

    // Initialize game systems
    this.init();
  }

  init() {
    // Set up Three.js scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x00001a, 0.005);

    // Create camera and renderer
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 20, 30);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    // Set up post-processing
    this.postProcessor = new PostProcessor(scene, camera);
    this.postProcessor.init(scene, camera);

    // Initialize game entities
    this.player = new PlayerShip(scene, camera, renderer);
    this.alienFormation = new AlienFormation(scene, camera, renderer);
    this.projectiles = [];
    this.enemyProjectiles = [];

    // Register game update function
    this.engine.registerUpdate(this.update.bind(this));

    // Start the game loop
    this.engine.start();

    // Handle window resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Initialize UI
    const scoreDisplay = new ScoreDisplay(document.getElementById('score-display'));
    this.scoreDisplay = scoreDisplay;

    const livesDisplay = new LivesDisplay(document.getElementById('lives-display'));
    this.livesDisplay = livesDisplay;

    const waveIndicator = new WaveIndicator(document.getElementById('wave-indicator'));
    this.waveIndicator = waveIndicator;

    // Start game loop
    this.gameLoop();
  }

  update(deltaTime) {
    if (this.engine.gameState !== 'playing') return;

    // Update player
    this.player.update(deltaTime);

    // Update alien formation
    const gameOver = this.alienFormation.update(deltaTime, this.projectiles, this.enemyProjectiles);
    if (gameOver) {
      this.gameState = 'gameOver';
      this.engine.setState('gameOver');
      return;
    }

    // Update player projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.active) continue;
      p.update(deltaTime);

      // Check projectile bounds
      if (p.y < -20 || p.y > 60) {
        p.dispose();
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check player collision
      if (this.checkProjectileCollision(p, 'player')) {
        this.handlePlayerHit();
        p.dispose();
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check enemy collision
      if (this.checkProjectileCollision(p, 'enemy')) {
        this.handleEnemyHit(p);
        p.dispose();
        this.projectiles.splice(i, 1);
        continue;
      }
    }

    // Update enemy projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      if (!p.active) continue;
      p.update(deltaTime);

      // Check projectile bounds
      if (p.y < -20 || p.y > 60) {
        p.dispose();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Check player collision
      if (this.checkProjectileCollision(p, 'player')) {
        this.handlePlayerHit();
        p.dispose();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
    }

    // Update particle system
    this.particleSystem.update(deltaTime);

    // Update camera shake
    if (this.cameraShake.update(deltaTime)) {
      const offset = this.cameraShake.getOffset();
      this.scene.camera.position.x += offset[0];
      this.scene.camera.position.y += offset[1];
    } else {
      // Smoothly return to center
      this.scene.camera.position.lerp(0, 0, 0.1);
    }

    // Update hit-stop
    if (this.hitStop.active) {
      this.engine.paused = true;
    } else {
      this.engine.resume();
    }

    // Check game over conditions
    if (this.alienFormation.isDefeated()) {
      this.wave++;
      this.alienFormation.reset(this.wave);
      this.score += 100 * this.wave;
      this.updateScoreDisplay();
    } else if (this.lives <= 0) {
      this.gameState = 'gameOver';
      this.engine.setState('gameOver');
    }

    // Update score display
    this.updateScoreDisplay();
  }

  checkProjectileCollision(projectile, targetType) {
    const p = projectile;

    if (targetType === 'player') {
      return this.player.checkCollision(p);
    } else if (targetType === 'enemy') {
      return this.alienFormation.checkProjectileCollision(p);
    }

    return false;
  }

  handlePlayerHit() {
    // Trigger hit-stop effect
    this.hitStop.trigger(10.0);

    // Screen shake based on impact velocity
    this.cameraShake.trigger(5.0);

    // Spawn explosion particles at player position
    this.particleSystem.emit('explosion', this.player.position.x, this.player.position.y, this.player.position.z, 2);

    // Spawn shockwave
    this.shockwaveManager.create(this.player.position.x, this.player.position.y, this.player.position.z, 15, 0.8);

    // Reduce lives
    this.lives--;
    this.updateScoreDisplay();

    // Respawn player after delay
    setTimeout(() => {
      if (this.engine.gameState === 'playing') {
        this.player.respawn();
      }
    }, 2000);
  }

  handleEnemyHit(projectile) {
    // Get the alien that was hit
    const alien = this.alienFormation.getHitAlien(projectile);
    if (!alien) return;

    // Spawn explosion particles at alien position
    this.particleSystem.emit('explosion', alien.position.x, alien.position.y, alien.position.z, 1.5);

    // Screen shake based on impact velocity
    this.cameraShake.trigger(3.0);

    // Spawn shockwave
    this.shockwaveManager.create(alien.position.x, alien.position.y, alien.position.z, 10, 0.6);

    // Add score based on alien row
    const points = (5 - alien.row) * 10;
    this.score += points;
    this.updateScoreDisplay();

    // Spawn floating score text
    this.spawnFloatingText(alien.position.x, alien.position.y, `+${points}`, '#ffdd00');

    // Remove the hit alien from formation
    this.alienFormation.removeAlien(alien);
  }

  spawnFloatingText(x, y, text, color) {
    const scoreDisplay = this.scoreDisplay;
    if (scoreDisplay) {
      scoreDisplay.addFloatingText(x, y, text, color);
    }
  }

  updateScoreDisplay() {
    if (this.scoreDisplay) {
      this.scoreDisplay.update(this.score, this.lives, this.wave);
    }
    if (this.livesDisplay) {
      this.livesDisplay.updateLives(this.lives);
    }
    if (this.waveIndicator) {
      this.waveIndicator.updateWave(this.wave);
    }
  }

  dispose() {
    // Dispose of all Three.js objects to prevent memory leaks
    for (const p of this.projectiles) {
      p.dispose();
    }
    for (const p of this.enemyProjectiles) {
      p.dispose();
    }
    if (this.player) {
      this.player.dispose();
    }
    if (this.alienFormation) {
      this.alienFormation.dispose();
    }
    this.particleSystem.clear();
    this.shockwaveManager.clear();
    this.hitStop.reset();
    this.trailManager.clear();
    this.postProcessor?.dispose();
  }
}

export default SpaceInvaders;