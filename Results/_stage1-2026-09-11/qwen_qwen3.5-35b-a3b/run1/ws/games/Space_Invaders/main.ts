import { GameEngine } from '../../shared/core/GameEngine.js';
import { InputManager } from '../../shared/core/InputManager.js';
import { ParticleManager } from '../../shared/core/ParticleManager.js';
import { MemoryManager } from '../../shared/core/MemoryManager.js';
import { CameraShake } from '../../shared/vfx/CameraShake.js';
import { HitStop } from '../../shared/vfx/HitStop.js';
import { MotionTrails } from '../../shared/vfx/MotionTrails.js';
import { ShockwaveManager } from '../../shared/vfx/ShockwaveRings.js';
import { FloatingTextSystem } from '../../shared/vfx/FloatingText.js';
import { EffectComposerSetup } from '../../shared/graphics/EffectComposerSetup.js';
import { AudioSynth } from '../../shared/utils/AudioSynth.js';
import { MathUtils } from '../../shared/utils/MathUtils.js';

import { PlayerShip } from './entities/PlayerShip.js';
import { Enemy } from './entities/Enemy.js';
import { Projectile, ProjectilePool } from './entities/Projectile.js';
import { PowerUp } from './entities/PowerUp.js';

import { GameManager } from './systems/GameManager.js';
import { EnemyFormation } from './systems/EnemyFormation.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { WaveManager } from './systems/WaveManager.js';

import { AlienSpriteGenerator } from './assets/AlienSpriteGen.js';
import { BackgroundGenerator } from './assets/BackgroundGen.js';
import { PowerUpIcons } from './assets/PowerUpIcons.js';

import { CONFIG } from './config.js';

class SpaceInvadersGame {
  private engine: GameEngine;
  private input: InputManager;
  private particles: ParticleManager;
  private memory: MemoryManager;
  private cameraShake: CameraShake;
  private hitStop: HitStop;
  private motionTrails: MotionTrails;
  private shockwaves: ShockwaveManager;
  private floatingText: FloatingTextSystem;
  private composerSetup: EffectComposerSetup;
  private audio: AudioSynth;

  // Game entities and systems
  private playerShip!: PlayerShip;
  private enemyFormation!: EnemyFormation;
  private projectiles!: ProjectilePool;
  private powerUps!: PowerUp[];
  private collisionSystem!: CollisionSystem;
  private waveManager!: WaveManager;
  private gameManager!: GameManager;

  // Three.js scene objects
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private stars: THREE.Group | null = null;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      window.innerWidth / window.innerHeight,
      CONFIG.camera.near,
      CONFIG.camera.far
    );
    
    // Initialize core systems
    this.engine = new GameEngine(this.onUpdate.bind(this), this.onRender.bind(this));
    this.input = new InputManager();
    this.particles = new ParticleManager(CONFIG.maxParticles);
    this.memory = new MemoryManager();
    this.cameraShake = new CameraShake(0.5, 2.0);
    this.hitStop = new HitStop(100);
    this.motionTrails = new MotionTrails();
    this.shockwaves = new ShockwaveManager();
    this.floatingText = new FloatingTextSystem('#game-container');
    
    // Initialize audio system
    this.audio = new AudioSynth();
    
    // Initialize post-processing - needs renderer first, so we'll init after setupRenderer()
    
    // Initialize game systems
    this.projectiles = new ProjectilePool(CONFIG.maxProjectiles, {
      speed: CONFIG.projectileSpeed,
      damage: 1,
      trailLength: CONFIG.trailLength,
      color: CONFIG.playerProjectileColor
    }, this.motionTrails);
    
    this.powerUps = [];
    this.collisionSystem = new CollisionSystem(this);
    this.waveManager = new WaveManager();
    this.gameManager = new GameManager(this);
    
    // Setup renderer and composer
    this.setupRenderer();
    this.composerSetup.init();
    
    // Create game world
    this.createWorld();
    
    // Event listeners
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => this.onVisibilityChange());
  }

  private setupRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Append to DOM (game container)
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.appendChild(this.renderer.domElement);
    }
    
    // Camera position
    this.camera.position.set(0, CONFIG.playerY + 5, CONFIG.cameraDistance);
    this.camera.lookAt(0, CONFIG.playerY, 0);
  }

  private createWorld(): void {
    // Create starfield background using BackgroundGenerator
    const bgGen = new BackgroundGenerator(CONFIG.starCount, Math.random() * 1000);
    const stars = bgGen.getStars();
    
    // Create simple point cloud for stars
    const positions = new Float32Array(stars.length * 3);
    for (let i = 0; i < stars.length; i++) {
      positions[i * 3] = stars[i].x * 50;
      positions[i * 3 + 1] = stars[i].y * 30;
      positions[i * 3 + 2] = -stars[i].z * 20;
    }
    
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      transparent: true,
      opacity: 0.8
    });
    this.stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.stars);
    
    // Create player ship
    this.playerShip = new PlayerShip(
      new THREE.Vector3(0, CONFIG.playerY, 0),
      this.audio,
      this.motionTrails
    );
    this.scene.add(this.playerShip.getMesh());
    
    // Initialize enemy formation using AlienSpriteGenerator
    const alienTextures: THREE.Texture[] = [];
    for (let row = 0; row < CONFIG.enemyRows; row++) {
      const texture = AlienSpriteGenerator.generateAlienTexture(row, CONFIG.rowColors[row], Date.now() * 0.001);
      alienTextures.push(texture);
    }
    
    this.enemyFormation = new EnemyFormation(
      CONFIG.enemyRows,
      CONFIG.enemyCols,
      CONFIG.enemySpacing,
      alienTextures,
      this.audio
    );
    
    // Add directional light for shadows and depth
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 10, 7);
    this.scene.add(dirLight);
  }

  private onUpdate(deltaTime: number): void {
    // Apply hit-stop timescale
    const effectiveDelta = deltaTime * this.hitStop.getTimescale();
    
    // Update input
    this.input.update();
    
    // Update camera shake
    this.cameraShake.update(effectiveDelta);
    if (this.cameraShake.shouldApply()) {
      const shake = this.cameraShake.getShakeVector();
      this.camera.position.x += shake.x * effectiveDelta;
      this.camera.position.y += shake.y * effectiveDelta;
    }
    
    // Update player ship
    this.playerShip.update(effectiveDelta, this.input);
    
    // Check if game should be paused
    if (this.gameManager.isPaused()) {
      return;
    }
    
    // Update enemy formation
    this.enemyFormation.update(effectiveDelta, this.camera.position);
    
    // Update projectiles
    this.projectiles.meshes.forEach((proj) => {
      proj.update(effectiveDelta);
    });
    
    // Update power-ups
    this.powerUps.forEach((powerUp) => {
      powerUp.update(effectiveDelta);
    });
    
    // Update wave manager (UFO spawning, etc.)
    this.waveManager.update(effectiveDelta);
    
    // Run collision detection
    this.collisionSystem.checkCollisions();
    
    // Update particles and VFX
    this.particles.update(effectiveDelta);
    this.motionTrails.update(effectiveDelta);
    this.shockwaves.update(effectiveDelta);
    this.floatingText.update(effectiveDelta);
    
    // Check game over conditions
    this.gameManager.checkGameState();
  }

  private onRender(): void {
    // Render with post-processing
    this.composerSetup.render();
  }

  public triggerCameraShake(intensity: number): void {
    this.cameraShake.shake(intensity);
  }

  public triggerHitStop(duration: number): void {
    this.hitStop.apply(duration);
  }

  public spawnParticles(position: THREE.Vector3, color: number, count: number): void {
    this.particles.spawnBurst(position, color, count);
  }

  public spawnShockwave(position: THREE.Vector3, radius: number = 1.0): void {
    this.shockwaves.spawn(position, radius);
  }

  public showFloatingText(text: string, position: THREE.Vector3, points: number): void {
    this.floatingText.show(text, position, points);
  }

  private onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
    this.composerSetup.onResize(width, height);
  }

  private onVisibilityChange(): void {
    if (document.hidden) {
      this.engine.pause();
    } else {
      this.engine.resume();
    }
  }

  public getGameManager(): GameManager {
    return this.gameManager;
  }

  public getPlayerShip(): PlayerShip {
    return this.playerShip;
  }

  public getEnemyFormation(): EnemyFormation {
    return this.enemyFormation;
  }

  public getProjectiles(): ProjectilePool {
    return this.projectiles;
  }

  public getPowerUps(): PowerUp[] {
    return this.powerUps;
  }

  public addPowerUp(powerUp: PowerUp): void {
    this.powerUps.push(powerUp);
    this.scene.add(powerUp.getMesh());
  }

  public removePowerUp(powerUp: PowerUp): void {
    const index = this.powerUps.indexOf(powerUp);
    if (index > -1) {
      this.powerUps.splice(index, 1);
      this.scene.remove(powerUp.getMesh());
    }
  }

  public playSound(type: 'laser' | 'explosion' | 'ufo' | 'powerup'): void {
    switch (type) {
      case 'laser':
        this.audio.playLaser();
        break;
      case 'explosion':
        this.audio.playExplosion();
        break;
      case 'ufo':
        this.audio.playUfo();
        break;
      case 'powerup':
        this.audio.playPowerUp();
        break;
    }
  }

  public dispose(): void {
    // Dispose all game objects
    this.playerShip.dispose();
    this.enemyFormation.dispose();
    this.projectiles.dispose();
    
    this.powerUps.forEach(p => p.dispose());
    this.powerUps = [];
    
    // Dispose VFX systems
    this.motionTrails.dispose();
    this.shockwaves.dispose();
    this.floatingText.dispose();
    
    // Dispose audio
    this.audio.dispose();
    
    // Dispose memory manager (disposes all tracked resources)
    this.memory.disposeAll();
    
    // Dispose renderer and composer
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    console.log('Space Invaders game disposed successfully');
  }

  public start(): void {
    this.engine.start();
  }

  public stop(): void {
    this.engine.stop();
  }
}

// Initialize game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const game = new SpaceInvadersGame();
  
  // Expose to window for debugging (optional)
  (window as any).spaceInvadersGame = game;
  
  // Start the game loop
  game.start();
  
  // Handle page unload
  window.addEventListener('beforeunload', () => {
    game.dispose();
  });
});

export default SpaceInvadersGame;