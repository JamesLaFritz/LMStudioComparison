// NEON INVASION — Space Invaders AAA Retro-Futurism Remaster v2.0
// Entry point that exports a boot() function for HTML integration.

import * as THREE from 'three';
import { setupComposer, resizeComposer } from './shared/postprocessing/composer.js';
import { InputController } from './shared/input/controller.js';
import { ParticleManager } from './shared/utils/particles.js';
import { CameraShake } from './shared/vfx/cameraShake.js';
import { HitStopManager } from './shared/vfx/hitStop.js';
import { MotionTrailManager } from './shared/vfx/motionTrails.js';
import { ShockwaveManager } from './shared/vfx/shockwave.js';
import { FloatingTextManager } from './shared/vfx/floatingText.js';
import { AudioSynth } from './shared/utils/audio.js';
import { Player } from './Space_Invaders/game/player.js';
import { Enemy, AlienType } from './Space_Invaders/game/enemy.js';
import { Projectile } from './Space_Invaders/game/projectile.js';
import { PowerUp, PowerUpType } from './Space_Invaders/game/powerUp.js';

// Global constants
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const ASPECT_RATIO = CANVAS_WIDTH / CANVAS_HEIGHT;

class SpaceInvadersGame {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.bloomPass = null;
    this.input = null;
    this.audio = null;
    this.particleManager = null;
    this.cameraShake = null;
    this.hitStop = null;
    this.motionTrails = null;
    this.shockwave = null;
    this.floatingText = null;
    
    this.player = null;
    this.gameLogic = null;
    this.projectiles = [];
    this.enemies = [];
    this.powerUps = [];
    this.stars = [];
    this.planet = null;
    this.reflectionPlane = null;
    
    this.lastTime = 0;
    this.accumulator = 0;
    this.step = 1/60;
    this.isRunning = false;
    this.isPaused = false;
    
    this.init();
  }

  init() {
    // Create canvas and renderer
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvas.id = 'gameCanvas';
    document.body.appendChild(canvas);
    
    this.renderer = new THREE.WebGLRenderer({ 
      canvas, 
      antialias: false,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0a0a15, 1.0);
    
    // Scene and camera (must be created before composer)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, ASPECT_RATIO, 0.1, 1000);
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);
    
    // Setup post-processing (needs scene and camera)
    const { composer, bloomPass } = setupComposer(this.renderer, this.scene, this.camera);
    this.composer = composer;
    this.bloomPass = bloomPass;
    
    // Initialize systems
    this.input = new InputController();
    this.audio = new AudioSynth();
    this.particleManager = new ParticleManager(this.scene, 500);
    this.cameraShake = new CameraShake(this.camera);
    this.hitStop = new HitStopManager();
    this.motionTrails = new MotionTrailManager(this.scene, this.camera);
    this.shockwave = new ShockwaveManager(this.scene);
    this.floatingText = new FloatingTextManager(this.renderer, this.camera);
    
    // Initialize game systems
    this.player = new Player(new THREE.Vector3(0, -3.5, 0));
    this.gameLogic = new GameLogic();
    
    // Create environment
    this.createEnvironment();
    
    // Event listeners
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => this.onVisibilityChange());
    
    // Start game loop
    this.isRunning = true;
    requestAnimationFrame((time) => this.loop(time));
  }

  createEnvironment() {
    // Starfield background
    for (let i = 0; i < 500; i++) {
      const seed = i * 12345 + 67890;
      const x = ((seed * 1103515245) % 1000000) / 1000000 * 40 - 20;
      const y = (((seed * 1103515245) >> 16) % 1000000) / 1000000 * 40 - 20;
      const depth = i / 500;
      
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 + depth * 0.3, 8, 8),
        new THREE.MeshBasicMaterial({ 
          color: new THREE.Color().setHSL(depth * 0.2, 1, 0.5 + depth * 0.5) 
        })
      );
      
      star.position.set(x, y, -50 - depth * 150);
      this.scene.add(star);
      this.stars.push({ mesh: star, speed: 0.1 + depth * 0.3 });
    }
    
    // Procedural planet horizon
    const planetGeo = new THREE.SphereGeometry(30, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const planetMat = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a3e,
      emissive: 0x0088ff,
      emissiveIntensity: 0.5,
      roughness: 0.8,
      metalness: 0.2
    });
    
    this.planet = new THREE.Mesh(planetGeo, planetMat);
    this.planet.position.set(0, -15, -20);
    this.scene.add(this.planet);
    
    // Reflection plane
    const planeGeo = new THREE.PlaneGeometry(40, 40);
    const planeMat = new THREE.MeshStandardMaterial({ 
      color: 0x0044ff,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.2
    });
    
    this.reflectionPlane = new THREE.Mesh(planeGeo, planeMat);
    this.reflectionPlane.rotation.x = -Math.PI / 2;
    this.reflectionPlane.position.y = -0.5;
    this.scene.add(this.reflectionPlane);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404060, 0.3);
    this.scene.add(ambientLight);
    
    const playerLight = new THREE.PointLight(0x00ffff, 0.5, 20, 1.0);
    playerLight.position.set(0, -3, 5);
    this.scene.add(playerLight);
    
    // UI Overlay
    this.createUI();
  }

  createUI() {
    const uiContainer = document.createElement('div');
    uiContainer.id = 'gameUI';
    uiContainer.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      font-family: 'Courier New', monospace;
      color: #00ffff;
    `;
    
    // Glassmorphism score display
    const scorePanel = document.createElement('div');
    scorePanel.style.cssText = `
      position: absolute;
      top: 20px; left: 20px;
      background: rgba(0, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 2px solid #00ffff;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
    `;
    
    const scoreTitle = document.createElement('div');
    scoreTitle.textContent = 'SCORE';
    scoreTitle.style.cssText = 'font-size: 14px; opacity: 0.8; margin-bottom: 5px;';
    
    this.scoreElement = document.createElement('div');
    this.scoreElement.id = 'scoreDisplay';
    this.scoreElement.textContent = '0';
    this.scoreElement.style.cssText = 'font-size: 24px; font-weight: bold; text-shadow: 0 0 10px #00ffff;';
    
    scorePanel.appendChild(scoreTitle);
    scorePanel.appendChild(this.scoreElement);
    uiContainer.appendChild(scorePanel);
    
    // Wave display
    const wavePanel = document.createElement('div');
    wavePanel.style.cssText = `
      position: absolute;
      top: 20px; right: 20px;
      background: rgba(255, 0, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 2px solid #ff00ff;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 0 20px rgba(255, 0, 255, 0.3);
    `;
    
    const waveTitle = document.createElement('div');
    waveTitle.textContent = 'WAVE';
    waveTitle.style.cssText = 'font-size: 14px; opacity: 0.8; margin-bottom: 5px;';
    
    this.waveElement = document.createElement('div');
    this.waveElement.id = 'waveDisplay';
    this.waveElement.textContent = '1';
    this.waveElement.style.cssText = 'font-size: 24px; font-weight: bold; text-shadow: 0 0 10px #ff00ff;';
    
    wavePanel.appendChild(waveTitle);
    wavePanel.appendChild(this.waveElement);
    uiContainer.appendChild(wavePanel);
    
    // Health display
    const healthPanel = document.createElement('div');
    healthPanel.style.cssText = `
      position: absolute;
      bottom: 20px; left: 20px;
      background: rgba(0, 255, 0, 0.1);
      backdrop-filter: blur(10px);
      border: 2px solid #00ff00;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
    `;
    
    const healthTitle = document.createElement('div');
    healthTitle.textContent = 'INTEGRITY';
    healthTitle.style.cssText = 'font-size: 14px; opacity: 0.8; margin-bottom: 5px;';
    
    this.healthBar = document.createElement('div');
    this.healthBar.id = 'healthBar';
    this.healthBar.style.cssText = `
      width: 200px; height: 10px;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 5px;
      overflow: hidden;
    `;
    
    this.healthFill = document.createElement('div');
    this.healthFill.id = 'healthFill';
    this.healthFill.style.cssText = `
      width: 100%; height: 100%;
      background: linear-gradient(90deg, #00ff00, #00ffff);
      transition: width 0.3s;
    `;
    
    this.healthBar.appendChild(this.healthFill);
    healthPanel.appendChild(healthTitle);
    healthPanel.appendChild(this.healthBar);
    uiContainer.appendChild(healthPanel);
    
    // Game over screen (hidden initially)
    this.gameOverScreen = document.createElement('div');
    this.gameOverScreen.id = 'gameOverScreen';
    this.gameOverScreen.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
    `;
    
    const gameOverTitle = document.createElement('h1');
    gameOverTitle.textContent = 'GAME OVER';
    gameOverTitle.style.cssText = `
      font-size: 48px;
      color: #ff0000;
      text-shadow: 0 0 20px #ff0000;
      margin-bottom: 30px;
    `;
    
    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'RESTART MISSION';
    restartBtn.style.cssText = `
      padding: 15px 30px;
      font-size: 20px;
      background: rgba(0, 255, 255, 0.2);
      border: 2px solid #00ffff;
      color: #00ffff;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      transition: all 0.3s;
    `;
    
    restartBtn.onmouseover = () => {
      restartBtn.style.background = 'rgba(0, 255, 255, 0.4)';
      restartBtn.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.5)';
    };
    
    restartBtn.onmouseout = () => {
      restartBtn.style.background = 'rgba(0, 255, 255, 0.2)';
      restartBtn.style.boxShadow = 'none';
    };
    
    restartBtn.onclick = () => this.restartGame();
    
    this.gameOverScreen.appendChild(gameOverTitle);
    this.gameOverScreen.appendChild(restartBtn);
    uiContainer.appendChild(this.gameOverScreen);
    
    document.body.appendChild(uiContainer);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const newAspect = width / height;
    
    this.camera.aspect = newAspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    resizeComposer(this.composer, width, height);
  }

  onVisibilityChange() {
    if (document.hidden) {
      this.isPaused = true;
    } else {
      this.isPaused = false;
      this.lastTime = performance.now();
    }
  }

  restartGame() {
    // Clear existing entities
    this.projectiles.forEach(p => {
      if (p.mesh) this.scene.remove(p.mesh);
    });
    this.enemies.forEach(e => {
      e.dispose();
      this.scene.remove(e.mesh);
    });
    this.powerUps.forEach(p => {
      if (p.mesh) this.scene.remove(p.mesh);
    });
    
    this.projectiles = [];
    this.enemies = [];
    this.powerUps = [];
    
    // Reset player and game logic
    this.player.reset();
    this.gameLogic.reset();
    
    // Hide game over screen
    this.gameOverScreen.style.display = 'none';
    
    // Resume audio context if suspended
    if (this.audio.context.state === 'suspended') {
      this.audio.context.resume();
    }
  }

  loop(currentTime) {
    if (!this.isRunning) return;
    
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    
    if (!this.isPaused && this.isRunning) {
      // Apply hit-stop timescale
      const timescale = this.hitStop.update(deltaTime);
      
      if (timescale > 0) {
        this.updateGame(deltaTime * timescale);
        this.render();
      } else {
        // Skip update during frame freeze but still render
        this.render();
      }
    }
    
    requestAnimationFrame((time) => this.loop(time));
  }

  updateGame(deltaTime) {
    // Update environment
    this.planet.rotation.y += 0.01 * deltaTime;
    this.stars.forEach(star => {
      star.mesh.position.x += star.speed * deltaTime;
      if (star.mesh.position.x > 20) star.mesh.position.x = -20;
    });
    
    // Update player
    const input = this.input.getInputs();
    this.player.update(deltaTime, input);
    
    // Add motion trail for fast movement
    if (this.player.velocity.length() > 5.0) {
      this.motionTrails.addTrail(this.player);
    }
    
    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(deltaTime);
      
      if (proj.isRemoved()) {
        this.scene.remove(proj.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
    }
    
    // Update enemies
    this.gameLogic.updateEnemies(deltaTime, this.player.position);
    
    // Update power-ups
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      powerUp.update(deltaTime);
      
      if (powerUp.isRemoved()) {
        this.scene.remove(powerUp.mesh);
        this.powerUps.splice(i, 1);
        continue;
      }
    }
    
    // Update VFX systems
    this.particleManager.update(deltaTime);
    this.cameraShake.update(deltaTime);
    this.motionTrails.updateTrails(deltaTime);
    this.shockwave.updateShockwaves(deltaTime);
    this.floatingText.updateTexts(deltaTime);
    
    // Check collisions
    this.checkCollisions();
    
    // Update UI
    this.updateUI();
  }

  checkCollisions() {
    const playerHitbox = {
      x: this.player.position.x,
      y: this.player.position.y,
      w: this.player.width,
      h: this.player.height
    };
    
    // Player bullets vs Aliens
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      
      if (!proj.isAlienBullet && !proj.active) continue;
      
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        
        if (!enemy.alive) continue;
        
        const enemyHitbox = {
          x: enemy.position.x,
          y: enemy.position.y,
          w: enemy.width,
          h: enemy.height
        };
        
        if (this.checkAABB(playerHitbox, enemyHitbox)) {
          // Player hit by alien bullet
          this.handlePlayerHit(enemyHitbox);
          proj.remove();
          this.scene.remove(proj.mesh);
          this.projectiles.splice(i, 1);
          break;
        } else if (this.checkAABB({x: proj.position.x, y: proj.position.y, w: 0.2, h: 0.5}, enemyHitbox)) {
          // Alien hit by player bullet
          this.handleAlienHit(proj, i, j);
          break;
        }
      }
    }
    
    // Alien bullets vs Player
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      
      if (!proj.isAlienBullet || !proj.active) continue;
      
      if (this.checkAABB(playerHitbox, {x: proj.position.x, y: proj.position.y, w: 0.2, h: 0.5})) {
        this.handlePlayerHit(playerHitbox);
        proj.remove();
        this.scene.remove(proj.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    
    // Power-ups vs Player
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      
      if (this.checkAABB(playerHitbox, {x: powerUp.position.x, y: powerUp.position.y, w: 0.5, h: 0.5})) {
        this.applyPowerUp(powerUp.type);
        this.scene.remove(powerUp.mesh);
        this.powerUps.splice(i, 1);
      }
    }
    
    // Check if aliens reached player row
    const lowestAlienY = Math.max(...this.enemies.filter(e => e.alive).map(e => e.position.y));
    if (lowestAlienY > -3.0) {
      this.gameOver();
    }
  }

  checkAABB(a, b) {
    const padding = 0.15;
    return a.x - a.w/2 + padding < b.x + b.w/2 - padding &&
           a.x + a.w/2 - padding > b.x - b.w/2 - padding &&
           a.y - a.h/2 + padding < b.y + b.h/2 - padding &&
           a.y + a.h/2 - padding > b.y - b.h/2 - padding;
  }

  handleAlienHit(bullet, bulletIndex, enemyIndex) {
    const enemy = this.enemies[enemyIndex];
    
    // Apply hit-stop and camera shake
    this.hitStop.triggerImpact(1.0);
    this.cameraShake.applyImpact(5.0);
    
    // Spawn particle burst
    this.particleManager.spawnBurst(enemy.position.clone(), 30, new THREE.Color(0xff8800));
    
    // Spawn shockwave
    this.shockwave.spawnShockwave(enemy.position.clone());
    
    // Play explosion sound
    this.audio.playExplosion();
    
    // Remove alien
    enemy.alive = false;
    enemy.mesh.visible = false;
    
    // Remove bullet
    bullet.remove();
    this.scene.remove(bullet.mesh);
    this.projectiles.splice(bulletIndex, 1);
    
    // Add score
    const points = this.gameLogic.addAlienKill(enemy.row, enemy.type);
    this.floatingText.spawnText(enemy.position.clone(), 'KILL', points);
    
    // Chance to drop power-up (3%)
    if (Math.random() < 0.03) {
      const type = PowerUpType[Math.floor(Math.random() * PowerUpType.length)];
      this.powerUps.push(new PowerUp(enemy.position.clone(), type));
    }
    
    // Check for wave clear
    if (!this.enemies.some(e => e.alive)) {
      this.gameLogic.startNextWave();
    }
  }

  handlePlayerHit(hitbox) {
    const health = this.gameLogic.playerHealth;
    
    if (health <= 0) return; // Already dead
    
    // Apply hit-stop and camera shake
    this.hitStop.triggerImpact(0.8);
    this.cameraShake.applyImpact(10.0);
    
    // Spawn particle burst at player position
    this.particleManager.spawnBurst(this.player.position.clone(), 40, new THREE.Color(0xff0000));
    
    // Play damage sound
    this.audio.playDamage();
    
    // Reduce health
    const oldHealth = this.gameLogic.playerHealth;
    this.gameLogic.playerHealth -= 1;
    
    if (this.gameLogic.playerHealth <= 0) {
      this.gameOver();
    } else {
      // Show floating damage text
      const damageText = `-${oldHealth - this.gameLogic.playerHealth}`;
      this.floatingText.spawnText(this.player.position.clone(), damageText, 0);
    }
    
    // Check if aliens reached player row (instant loss)
    const lowestAlienY = Math.max(...this.enemies.filter(e => e.alive).map(e => e.position.y));
    if (lowestAlienY > -3.0) {
      this.gameOver();
    }
  }

  applyPowerUp(type) {
    switch (type) {
      case 'spread':
        this.player.powerUps.spread = true;
        setTimeout(() => { this.player.powerUps.spread = false; }, 10000);
        break;
      case 'shield':
        this.player.powerUps.shield = true;
        setTimeout(() => { this.player.powerUps.shield = false; }, 8000);
        break;
      case 'rapid':
        this.player.powerUps.rapidFire = true;
        setTimeout(() => { this.player.powerUps.rapidFire = false; }, 10000);
        break;
    }
    
    // Visual feedback
    const color = type === 'spread' ? 0x00ffff : 
                  type === 'shield' ? 0x00ff00 : 0xffff00;
    this.particleManager.spawnBurst(this.player.position.clone(), 20, new THREE.Color(color));
    
    // Floating text
    const text = type.toUpperCase();
    this.floatingText.spawnText(this.player.position.clone(), `POWER-UP: ${text}`, 100);
    
    // Play power-up sound
    this.audio.playPowerUp();
  }

  gameOver() {
    if (!this.gameLogic.gameOver) return;
    
    this.isRunning = false;
    this.gameOverScreen.style.display = 'flex';
    
    // Final particle burst
    this.particleManager.spawnBurst(this.player.position.clone(), 100, new THREE.Color(0xff0000));
    
    // Play death sound
    this.audio.playDeath();
    
    // Show final score
    const finalScore = document.createElement('div');
    finalScore.textContent = `FINAL SCORE: ${this.gameLogic.score}`;
    finalScore.style.cssText = `
      font-size: 32px;
      color: #ffff00;
      text-shadow: 0 0 15px #ffff00;
      margin-bottom: 20px;
    `;
    
    const gameOverTitle = this.gameOverScreen.querySelector('h1');
    if (gameOverTitle) {
      gameOverTitle.textContent = 'MISSION FAILED';
    }
    
    const restartBtn = this.gameOverScreen.querySelector('button');
    if (restartBtn) {
      restartBtn.textContent = 'RETRY MISSION';
    }
  }

  updateUI() {
    // Update score display
    this.scoreElement.textContent = this.gameLogic.score.toLocaleString();
    
    // Update wave display
    this.waveElement.textContent = this.gameLogic.waveNumber;
    
    // Update health bar
    const maxHealth = 10;
    const healthPercent = (this.gameLogic.playerHealth / maxHealth) * 100;
    this.healthFill.style.width = `${Math.max(0, healthPercent)}%`;
    
    // Change health color based on percentage
    if (healthPercent > 60) {
      this.healthFill.style.background = 'linear-gradient(90deg, #00ff00, #00ffff)';
    } else if (healthPercent > 30) {
      this.healthFill.style.background = 'linear-gradient(90deg, #ffff00, #ff8800)';
    } else {
      this.healthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff4400)';
    }
  }

  render() {
    // Update reflection plane to follow player
    if (this.reflectionPlane) {
      this.reflectionPlane.position.x = this.player.position.x;
    }
    
    // Render scene with post-processing
    this.composer.render();
  }

  dispose() {
    this.isRunning = false;
    
    // Dispose all systems
    this.particleManager.dispose();
    this.motionTrails.dispose();
    this.shockwave.dispose();
    this.floatingText.dispose();
    
    // Dispose game entities
    this.player.dispose();
    this.enemies.forEach(e => e.dispose());
    this.powerUps.forEach(p => {
      if (p.mesh) p.mesh.dispose();
    });
    
    // Dispose environment
    this.scene.clear();
    this.renderer.dispose();
    
    // Remove UI
    const uiContainer = document.getElementById('gameUI');
    if (uiContainer) uiContainer.remove();
  }
}

// Export boot function for HTML integration
export function boot(container) {
  window.gameInstance = new SpaceInvadersGame();
  return () => window.gameInstance.dispose();
}

// Initialize game when DOM is ready (fallback for direct script inclusion)
document.addEventListener('DOMContentLoaded', () => {
  if (!window.gameInstance && document.getElementById('gameCanvas')) {
    window.gameInstance = new SpaceInvadersGame();
  }
});