import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { SoundEngine } from '../../shared/audio/SoundEngine.js';
import { InputManager } from '../../shared/input/InputManager.js';
import { ObjectPool } from '../../shared/pool/ObjectPool.js';
import { ParticleManager } from '../../shared/particles/ParticleManager.js';
import { CameraShake } from '../../shared/vfx/CameraShake.js';
import { HitStop } from '../../shared/vfx/HitStop.js';
import { MotionTrails } from '../../shared/vfx/MotionTrails.js';
import { UIManager } from '../../shared/ui/UIManager.js';

import { Config } from './config.js';
import * as Physics from './systems/Physics.js';
import { Player } from './entities/Player.js';
import { Alien } from './entities/Alien.js';
import { Projectile } from './entities/Projectile.js';
import { Barrier } from './entities/Barrier.js';
import { MysteryShip } from './entities/MysteryShip.js';
import { PowerUp } from './entities/PowerUp.js';
import { HealthComponent } from './components/HealthComponent.js';
import { ScoreComponent } from './components/ScoreComponent.js';
import { GameUI } from './ui/GameUI.js';

class SpaceInvadersGame {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.clock = new THREE.Clock();
    
    // Shared systems
    this.soundEngine = null;
    this.inputManager = null;
    this.particleManager = null;
    this.cameraShake = null;
    this.hitStop = null;
    this.motionTrails = null;
    this.uiManager = null;
    
    // Game entities
    this.player = null;
    this.aliens = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.barriers = [];
    this.mysteryShip = null;
    this.powerUps = [];
    this.shockwaves = [];
    
    // Game state
    this.score = 0;
    this.lives = Config.PLAYER_LIVES;
    this.wave = 1;
    this.gameState = 'menu'; // menu, playing, gameover, victory
    
    // Alien movement state
    this.alienDirection = -1; // -1 = left, +1 = right
    this.alienSpeed = Config.ALIEN_BASE_SPEED;
    this.alienDestroyedCount = 0;
    this.alienShootChance = Config.ALIEN_SHOOT_CHANCE_BASE;
    
    // Mystery ship timer
    this.mysteryShipTimer = 0;
    this.mysteryShipInterval = Config.MYSTERY_SHIP_INTERVAL_MIN;
    
    // Power-up state
    this.activePowerUp = null;
    this.powerUpTimer = 0;
    
    // Starfield instances
    this.starInstances = { near: [], mid: [], far: [] };
    this.starMeshes = [];
    
    // Grid floor
    this.gridFloor = null;
    
    // Shockwave pool
    this.shockwavePool = null;
    
    // Animation state for formation morphing
    this.formationMorphTarget = 'grid';
    this.formationMorphProgress = 0;
    this.formationMorphDuration = 2.0;
    this.formationMorphActive = false;
    
    // Alien animation (wobble)
    this.alienWobbleTime = 0;
    
    // Player trail particles timer
    this.playerTrailTimer = 0;
    
    // Cleanup flag
    this.isDestroyed = false;
  }

  init() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1e);
    this.scene.fog = new THREE.FogExp2(0x0a0a1e, 0.02);

    // Camera - isometric perspective
    const cameraDistance = 18;
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(cameraDistance * 0.6, cameraDistance * 0.7, cameraDistance * 0.6);
    this.camera.lookAt(0, 0, -2);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.body.appendChild(this.renderer.domElement);

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2, // strength
      0.4, // radius
      0.2  // threshold
    );
    this.composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    // Shared systems
    this.soundEngine = new SoundEngine();
    this.inputManager = new InputManager();
    this.particleManager = new ParticleManager(this.scene, 500);
    this.cameraShake = new CameraShake(this.camera);
    this.hitStop = new HitStop();
    this.motionTrails = new MotionTrails(this.scene);
    this.uiManager = new UIManager(document.body);

    // Shockwave pool
    this.shockwavePool = new ObjectPool(
      () => this.createShockwave(),
      (sw) => { sw.mesh.visible = false; },
      20
    );

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.3);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 5);
    this.scene.add(directionalLight);

    // Build environment
    this.createStarfield();
    this.createGridFloor();

    // Setup UI
    this.gameUI = new GameUI(this.uiManager, document.body);
    this.updateUI();
    this.gameUI.showStartScreen();

    // Event listeners
    window.addEventListener('resize', () => this.onResize());
    
    // Start game loop
    this.animate();
  }

  createStarfield() {
    const starGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    
    // Near stars (brighter)
    const nearCount = 100;
    const nearMesh = new THREE.InstancedMesh(starGeometry, 
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 }), 
      nearCount);
    
    const farCount = 100;
    const farMesh = new THREE.InstancedMesh(starGeometry,
      new THREE.MeshStandardMaterial({ color: 0x8888ff, emissive: 0x4444aa, emissiveIntensity: 0.3 }),
      farCount);
    
    const midCount = 100;
    const midMesh = new THREE.InstancedMesh(starGeometry,
      new THREE.MeshStandardMaterial({ color: 0xaaccff, emissive: 0x6688cc, emissiveIntensity: 0.6 }),
      midCount);

    this.starMeshes.push(nearMesh, farMesh, midMesh);
    
    // Populate instances
    const dummy = new THREE.Object3D();
    
    for (let i = 0; i < nearCount; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10 - 5
      );
      dummy.scale.setScalar(Math.random() * 0.5 + 0.5);
      dummy.updateMatrix();
      nearMesh.setMatrixAt(i, dummy.matrix);
    }
    
    for (let i = 0; i < midCount; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10 - 10
      );
      dummy.scale.setScalar(Math.random() * 0.5 + 0.5);
      dummy.updateMatrix();
      midMesh.setMatrixAt(i, dummy.matrix);
    }
    
    for (let i = 0; i < farCount; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10 - 15
      );
      dummy.scale.setScalar(Math.random() * 0.5 + 0.5);
      dummy.updateMatrix();
      farMesh.setMatrixAt(i, dummy.matrix);
    }

    this.scene.add(nearMesh, midMesh, farMesh);
    this.starInstances.near = nearMesh;
    this.starInstances.mid = midMesh;
    this.starInstances.far = farMesh;
  }

  createGridFloor() {
    const gridShaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x00ffff) },
        uTime: { value: 0.0 },
        uCameraPos: { value: new THREE.Vector3() }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        uniform vec3 uCameraPos;
        varying vec2 vUv;
        
        void main() {
          vec2 worldPos = vUv * 40.0 - 20.0;
          float lineX = abs(fract(worldPos.x) - 0.5);
          float lineY = abs(fract(worldPos.y + uTime * 0.1) - 0.5);
          
          float lineWidth = 0.03;
          float gridX = step(lineWidth, lineX);
          float gridY = step(lineWidth, lineY);
          float grid = max(gridX, gridY);
          
          float dist = length(worldPos - uCameraPos.xz * 0.5);
          float fade = 1.0 - smoothstep(5.0, 25.0, dist);
          
          float alpha = (1.0 - grid) * 0.6 * fade;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const gridGeometry = new THREE.PlaneGeometry(40, 20);
    this.gridFloor = new THREE.Mesh(gridGeometry, gridShaderMaterial);
    this.gridFloor.rotation.x = -Math.PI / 2;
    this.gridFloor.position.y = Config.GROUND_Y;
    this.scene.add(this.gridFloor);
  }

  loadGame() {
    // Create player
    this.player = new Player(this.scene, Config);
    this.motionTrails.addTrackedObject('player', 0x00ff88, 8);
    
    // Create alien grid
    this.spawnAliens();
    
    // Create barriers
    this.createBarriers();
    
    // Create mystery ship
    this.mysteryShip = new MysteryShip(this.scene, Config);
    this.motionTrails.addTrackedObject('mystery', 0xff00ff, 8);
    
    // Reset game state
    this.score = 0;
    this.lives = Config.PLAYER_LIVES;
    this.wave = 1;
    this.alienDestroyedCount = 0;
    this.alienSpeed = Config.ALIEN_BASE_SPEED;
    this.alienShootChance = Config.ALIEN_SHOOT_CHANCE_BASE;
    this.mysteryShipTimer = Math.random() * (Config.MYSTERY_SHIP_INTERVAL_MAX - Config.MYSTERY_SHIP_INTERVAL_MIN) + Config.MYSTERY_SHIP_INTERVAL_MIN;
    this.activePowerUp = null;
    this.powerUpTimer = 0;
    
    // Clear old entities
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.powerUps = [];
    this.shockwaves = [];
    
    this.updateUI();
  }

  spawnAliens() {
    // Remove existing aliens
    for (const alien of this.aliens) {
      alien.destroy();
    }
    this.aliens = [];
    
    const rows = Config.ALIEN_GRID_ROWS;
    const cols = Config.ALIEN_GRID_COLS;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let type;
        if (row === 0) type = 'squid';
        else if (row <= 2) type = 'octopus';
        else type = 'crab';
        
        const alien = new Alien(type, { row, col }, this.scene, Config);
        this.aliens.push(alien);
      }
    }
    
    // Update instance meshes
    this.updateAlienInstanceMeshes();
  }

  updateAlienInstanceMeshes() {
    // This is handled within Alien class via InstancedMesh
    // Each alien type manages its own instanced mesh
  }

  createBarriers() {
    for (const barrier of this.barriers) {
      barrier.destroy();
    }
    this.barriers = [];
    
    const positions = [-6, -2, 2, 6];
    for (const x of positions) {
      const barrier = new Barrier(this.scene, { x, y: Config.BARRIER_Y }, Config);
      this.barriers.push(barrier);
    }
  }

  updateUI() {
    this.gameUI.update(this.score, this.lives, this.wave);
  }

  handleInput(deltaTime) {
    const horizontal = this.inputManager.getAxis('horizontal');
    const fire = this.inputManager.isButtonPressed('fire');
    
    if (this.player && this.gameState === 'playing') {
      this.player.update(deltaTime, horizontal);
      
      if (fire && !this.inputManager.wasJustPressed('fire')) {
        // Handled in player.shoot() with cooldown
      }
      
      if (fire) {
        const projectile = this.player.shoot(this.scene, this.projectilePool);
        if (projectile) {
          this.projectiles.push(projectile);
          this.soundEngine.playPlayerShoot();
          
          // Add motion trail for player projectile
          this.motionTrails.updatePosition('player_bullet_' + this.projectiles.length, projectile.getMesh().position.clone());
        }
      }
    }
  }

  updateAliens(deltaTime) {
    if (this.aliens.length === 0) return;
    
    // Update alien speed based on destroyed count
    this.alienSpeed = Math.min(
      Config.ALIEN_BASE_SPEED + this.alienDestroyedCount * Config.ALIEN_SPEED_INCREMENT,
      Config.ALIEN_BASE_SPEED * 4
    );
    
    // Move aliens
    let minX = Infinity;
    let maxX = -Infinity;
    
    for (const alien of this.aliens) {
      if (!alien.isActive()) continue;
      
      const mesh = alien.getMesh();
      mesh.position.x += this.alienDirection * this.alienSpeed * deltaTime;
      
      minX = Math.min(minX, mesh.position.x);
      maxX = Math.max(maxX, mesh.position.x);
      
      // Alien wobble animation
      this.alienWobbleTime += deltaTime;
      mesh.rotation.z = Math.sin(this.alienWobbleTime * 2 + mesh.position.x) * 0.1;
    }
    
    // Check boundary collision
    if (minX <= Config.ALIEN_BOUNDARY_MIN || maxX >= Config.ALIEN_BOUNDARY_MAX) {
      this.alienDirection = -this.alienDirection;
      
      for (const alien of this.aliens) {
        if (!alien.isActive()) continue;
        alien.getMesh().position.y -= Config.ALIEN_STEP_DOWN;
        
        // Check if aliens reached bottom
        if (alien.getMesh().position.y <= Config.PLAYER_Y - 2) {
          this.gameState = 'gameover';
          this.soundEngine.playGameOver();
          this.gameUI.showGameOver(this.score);
          return;
        }
      }
    }
    
    // Alien shooting
    for (const alien of this.aliens) {
      if (!alien.isActive()) continue;
      
      if (alien.shouldShoot(this.alienShootChance, this.wave)) {
        const projectile = alien.shoot(this.scene, this.enemyProjectilePool);
        if (projectile && this.enemyProjectiles.length < Config.MAX_ENEMY_PROJECTILES) {
          this.enemyProjectiles.push(projectile);
        }
      }
    }
    
    // Formation morphing for wave 3+
    if (this.wave >= 3 && !this.formationMorphActive && Math.random() < 0.001 * this.wave) {
      this.startFormationMorph();
    }
    
    if (this.formationMorphActive) {
      this.formationMorphProgress += deltaTime / this.formationMorphDuration;
      
      if (this.formationMorphProgress >= 1.0) {
        this.formationMorphActive = false;
        this.formationMorphProgress = 0;
      }
    }
  }

  startFormationMorph() {
    const patterns = ['v-shape', 'diamond'];
    this.formationMorphTarget = patterns[Math.floor(Math.random() * patterns.length)];
    this.formationMorphActive = true;
    this.formationMorphProgress = 0;
    
    for (let i = 0; i < this.aliens.length; i++) {
      const alien = this.aliens[i];
      if (!alien.isActive()) continue;
      
      const row = Math.floor(i / Config.ALIEN_GRID_COLS);
      const col = i % Config.ALIEN_GRID_COLS;
      
      let targetX, targetY;
      
      if (this.formationMorphTarget === 'v-shape') {
        const centerCol = (Config.ALIEN_GRID_COLS - 1) / 2;
        const distFromCenter = Math.abs(col - centerCol);
        targetX = col * Config.ALIEN_SPACING_X - (Config.ALIEN_GRID_COLS * Config.ALIEN_SPACING_X) / 2 + Config.ALIEN_SPACING_X / 2;
        targetY = Config.ALIEN_START_Y - distFromCenter * Config.ALIEN_SPACING_Y * 0.5;
      } else { // diamond
        const centerCol = (Config.ALIEN_GRID_COLS - 1) / 2;
        const centerRow = (Config.ALIEN_GRID_ROWS - 1) / 2;
        targetX = (col - centerCol) * Config.ALIEN_SPACING_X * (1 - Math.abs(row - centerRow) / (centerRow + 1));
        targetY = (row - centerRow) * Config.ALIEN_SPACING_Y * (1 - Math.abs(col - centerCol) / (centerCol + 1));
      }
      
      alien.setFormationPosition(new THREE.Vector3(targetX, targetY, 0), this.formationMorphDuration);
    }
  }

  updateProjectiles(deltaTime) {
    // Player projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj || !proj.isActive()) {
        this.projectiles.splice(i, 1);
        continue;
      }
      
      proj.update(deltaTime);
      
      // Check bounds
      if (proj.getMesh().position.y > Config.PLAYER_Y + 5) {
        proj.deactivate();
        this.projectilePool.release(proj);
        this.projectiles.splice(i, 1);
        continue;
      }
      
      // Update motion trail
      this.motionTrails.updatePosition('player_bullet_' + i, proj.getMesh().position.clone());
    }
    
    // Enemy projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];
      if (!proj || !proj.isActive()) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
      
      proj.update(deltaTime);
      
      // Check bounds
      if (proj.getMesh().position.y < Config.GROUND_Y) {
        proj.deactivate();
        this.enemyProjectilePool.release(proj);
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
    }
  }

  updateBarriers(deltaTime) {
    // Barriers are static, only updated on collision
  }

  updateMysteryShip(deltaTime) {
    if (!this.mysteryShip.isActive()) {
      this.mysteryShipTimer -= deltaTime;
      
      if (this.mysteryShipTimer <= 0) {
        const direction = Math.random() > 0.5 ? 1 : -1;
        this.mysteryShip.activate(direction);
        this.soundEngine.playMysteryShip();
        
        // Reset timer with reduced interval for higher waves
        const interval = Math.max(
          Config.MYSTERY_SHIP_INTERVAL_MIN,
          Config.MYSTERY_SHIP_INTERVAL_MAX - (this.wave - 1) * 2
        );
        this.mysteryShipTimer = Math.random() * (interval - interval * 0.5) + interval * 0.5;
      }
    } else {
      this.mysteryShip.update(deltaTime);
      
      // Update motion trail
      this.motionTrails.updatePosition('mystery', this.mysteryShip.getMesh().position.clone());
      
      if (!this.mysteryShip.isActive()) {
        // Mystery ship left screen without being destroyed
        this.soundEngine.playMysteryShipMiss();
      }
    }
  }

  updatePowerUps(deltaTime) {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      if (!powerUp.isActive()) {
        this.powerUps.splice(i, 1);
        continue;
      }
      
      powerUp.update(deltaTime);
    }
    
    // Update active power-up timer
    if (this.activePowerUp) {
      this.powerUpTimer -= deltaTime;
      if (this.powerUpTimer <= 0) {
        this.deactivatePowerUp();
      }
    }
  }

  checkCollisions() {
    // Player projectiles vs aliens
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.isActive()) continue;
      
      for (const alien of this.aliens) {
        if (!alien.isActive()) continue;
        
        if (Physics.checkAABB(proj.getMesh().position, Config.PROJECTILE_RADIUS, 
                              alien.getMesh().position, Config.ALIEN_RADIUS)) {
          // Hit!
          proj.deactivate();
          this.projectilePool.release(proj);
          this.projectiles.splice(i, 1);
          
          const points = alien.die(this.scene, this.particleManager, this.shockwavePool);
          this.score += points;
          this.alienDestroyedCount++;
          
          // VFX
          this.cameraShake.addTrauma(0.15);
          this.hitStop.trigger(0.06);
          this.soundEngine.playAlienHit();
          
          // Score component adds floating text
          const scoreComp = new ScoreComponent();
          scoreComp.addPoints(points, alien.getMesh().position.clone(), this.uiManager);
          
          // Check for power-up drop
          if (Math.random() < Config.POWERUP_DROP_CHANCE) {
            this.spawnPowerUp(alien.getMesh().position.clone());
          }
          
          break;
        }
      }
    }
    
    // Player projectiles vs mystery ship
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.isActive()) continue;
      
      if (this.mysteryShip.isActive() && 
          Physics.checkAABB(proj.getMesh().position, Config.PROJECTILE_RADIUS,
                            this.mysteryShip.getMesh().position, Config.MYSTERY_SHIP_RADIUS)) {
        proj.deactivate();
        this.projectilePool.release(proj);
        this.projectiles.splice(i, 1);
        
        const points = this.mysteryShip.destroy(this.scene, this.particleManager, this.shockwavePool);
        this.score += points;
        
        // VFX
        this.cameraShake.addTrauma(0.3);
        this.hitStop.trigger(0.15);
        this.soundEngine.playMysteryShipDestroyed();
        
        const scoreComp = new ScoreComponent();
        scoreComp.addPoints(points, this.mysteryShip.getMesh().position.clone(), this.uiManager);
        
        break;
      }
    }
    
    // Player projectiles vs barriers
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.isActive()) continue;
      
      for (const barrier of this.barriers) {
        const hit = barrier.takeDamage(proj.getMesh().position.clone(), 0x00ff88);
        if (hit) {
          proj.deactivate();
          this.projectilePool.release(proj);
          this.projectiles.splice(i, 1);
          
          // Spawn spark particles at impact point
          this.particleManager.spawnSpark(hit.position, 0x00ff88, 5);
          break;
        }
      }
    }
    
    // Enemy projectiles vs player
    if (this.player && !this.player.isInvulnerable()) {
      for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
        const proj = this.enemyProjectiles[i];
        if (!proj.isActive()) continue;
        
        if (Physics.checkAABB(proj.getMesh().position, Config.PROJECTILE_RADIUS,
                              this.player.getMesh().position, Config.PLAYER_RADIUS)) {
          proj.deactivate();
          this.enemyProjectilePool.release(proj);
          this.enemyProjectiles.splice(i, 1);
          
          this.player.takeDamage(this.scene, this.particleManager, this.shockwavePool);
          this.lives--;
          
          // VFX
          this.cameraShake.addTrauma(0.5);
          this.hitStop.trigger(0.2);
          this.soundEngine.playPlayerDeath();
          
          if (this.lives <= 0) {
            this.gameState = 'gameover';
            this.soundEngine.playGameOver();
            this.gameUI.showGameOver(this.score);
          } else {
            this.updateUI();
          }
          
          break;
        }
      }
    }
    
    // Enemy projectiles vs barriers
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];
      if (!proj.isActive()) continue;
      
      for (const barrier of this.barriers) {
        const hit = barrier.takeDamage(proj.getMesh().position.clone(), 0xff4444);
        if (hit) {
          proj.deactivate();
          this.enemyProjectilePool.release(proj);
          this.enemyProjectiles.splice(i, 1);
          
          // Spawn spark particles at impact point
          this.particleManager.spawnSpark(hit.position, 0xff4444, 5);
          break;
        }
      }
    }
    
    // Player vs power-ups
    if (this.player) {
      for (let i = this.powerUps.length - 1; i >= 0; i--) {
        const powerUp = this.powerUps[i];
        if (!powerUp.isActive()) continue;
        
        if (Physics.checkAABB(this.player.getMesh().position, Config.PLAYER_RADIUS,
                              powerUp.getMesh().position, Config.POWERUP_RADIUS)) {
          powerUp.deactivate();
          this.powerUps.splice(i, 1);
          
          this.activatePowerUp(powerUp.getType());
          this.soundEngine.playPowerUp();
        }
      }
    }
    
    // Check if all aliens destroyed (wave complete)
    if (this.aliens.length > 0 && this.aliens.every(a => !a.isActive())) {
      this.wave++;
      this.alienShootChance = Math.min(0.005 + this.wave * 0.001, 0.02);
      this.spawnAliens();
      this.updateUI();
      
      // Wave start SFX
      this.soundEngine.playWaveStart();
    }
  }

  spawnPowerUp(position) {
    const types = ['spread', 'rapid', 'shield'];
    const type = types[Math.floor(Math.random() * types.length)];
    const powerUp = new PowerUp(this.scene, position.clone(), type);
    this.powerUps.push(powerUp);
  }

  activatePowerUp(type) {
    this.deactivatePowerUp();
    
    this.activePowerUp = type;
    
    switch (type) {
      case 'spread':
        this.player.setSpreadShot(true);
        this.powerUpTimer = 8.0;
        break;
      case 'rapid':
        this.player.setRapidFire(true);
        this.powerUpTimer = 8.0;
        break;
      case 'shield':
        this.player.activateShield();
        this.powerUpTimer = 5.0;
        break;
    }
    
    const uiTexts = { spread: 'SPREAD SHOT!', rapid: 'RAPID FIRE!', shield: 'SHIELD ACTIVE!' };
    this.uiManager.addFloatingText(uiTexts[type], new THREE.Vector3(0, 2, 0));
  }

  deactivatePowerUp() {
    if (this.activePowerUp) {
      switch (this.activePowerUp) {
        case 'spread':
          this.player.setSpreadShot(false);
          break;
        case 'rapid':
          this.player.setRapidFire(false);
          break;
        case 'shield':
          this.player.deactivateShield();
          break;
      }
      this.activePowerUp = null;
    }
  }

  updateShockwaves(deltaTime) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      if (!sw || !sw.mesh.visible) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      
      sw.update(deltaTime);
      
      if (sw.opacity <= 0) {
        this.shockwavePool.release(sw);
        this.shockwaves.splice(i, 1);
      }
    }
  }

  createShockwave() {
    const geometry = new THREE.TorusGeometry(0.1, 0.02, 16, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xff00ff,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 1.0,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
    
    return {
      mesh: mesh,
      radius: 0.1,
      maxRadius: 2.0,
      duration: 0.4,
      elapsed: 0,
      opacity: 1.0,
      color: new THREE.Color(0xff00ff),
      
      update(deltaTime) {
        this.elapsed += deltaTime;
        const progress = Math.min(this.elapsed / this.duration, 1.0);
        
        this.radius = 0.1 + (this.maxRadius - 0.1) * progress;
        this.opacity = Math.max(0, 1.0 - progress);
        
        this.mesh.scale.setScalar(this.radius / 0.1);
        this.mesh.material.opacity = this.opacity;
      },
      
      setColor(color) {
        this.color.copy(color);
        this.mesh.material.emissive.copy(color);
        this.mesh.material.color.copy(color);
      }
    };
  }

  updatePlayerTrail(deltaTime) {
    if (!this.player || !this.player.getMesh()) return;
    
    this.playerTrailTimer += deltaTime;
    
    if (this.playerTrailTimer > 0.2 && Math.abs(this.player.getInputDirection()) > 0.5) {
      this.playerTrailTimer = 0;
      
      // Spawn trail particles
      const pos = this.player.getMesh().position.clone();
      pos.z += 0.3; // Behind the ship
      this.particleManager.spawnBurst(pos, 2, 0x00ff88, [1, 3], [0.2, 0.4]);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  cleanup() {
    this.isDestroyed = true;
    
    // Dispose all geometries and materials
    for (const alien of this.aliens) {
      alien.destroy();
    }
    
    if (this.player) this.player.destroy();
    if (this.mysteryShip) this.mysteryShip.destroy();
    
    for (const proj of this.projectiles) {
      proj.destroy();
    }
    for (const proj of this.enemyProjectiles) {
      proj.destroy();
    }
    
    for (const barrier of this.barriers) {
      barrier.destroy();
    }
    
    for (const powerUp of this.powerUps) {
      powerUp.destroy();
    }
    
    // Dispose starfield
    for (const mesh of this.starMeshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    
    // Dispose grid floor
    if (this.gridFloor) {
      this.gridFloor.geometry.dispose();
      this.gridFloor.material.dispose();
    }
    
    // Dispose particle manager
    if (this.particleManager) {
      this.particleManager.dispose();
    }
    
    // Dispose motion trails
    if (this.motionTrails) {
      this.motionTrails.dispose();
    }
    
    // Clear pools
    if (this.projectilePool) this.projectilePool.clear();
    if (this.enemyProjectilePool) this.enemyProjectilePool.clear();
    if (this.shockwavePool) this.shockwavePool.clear();
    
    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      document.body.removeChild(this.renderer.domElement);
    }
    
    // Remove event listeners
    window.removeEventListener('resize', () => this.onResize());
  }

  animate() {
    if (this.isDestroyed) return;
    
    requestAnimationFrame(() => this.animate());
    
    const rawDelta = this.clock.getDelta();
    const deltaTime = Math.min(rawDelta, 0.1); // Cap delta to prevent spiral of death
    
    // Hit-stop: scale delta time
    const timescale = this.hitStop.getTimescale(deltaTime);
    const scaledDelta = deltaTime * timescale;
    
    if (this.gameState === 'playing') {
      // Update systems
      this.handleInput(scaledDelta);
      this.updateAliens(scaledDelta);
      this.updateProjectiles(scaledDelta);
      this.updateBarriers(scaledDelta);
      this.updateMysteryShip(scaledDelta);
      this.updatePowerUps(scaledDelta);
      this.checkCollisions();
      this.updateShockwaves(scaledDelta);
      this.updatePlayerTrail(scaledDelta);
      
      // Update VFX systems (always run, even during hit-stop for visual continuity)
      this.cameraShake.update(deltaTime);
      this.hitStop.update(deltaTime);
      this.particleManager.update(deltaTime);
      
      // Update grid floor shader
      if (this.gridFloor) {
        this.gridFloor.material.uniforms.uTime.value = this.clock.elapsedTime;
        this.gridFloor.material.uniforms.uCameraPos.value.copy(this.camera.position);
      }
      
      // Update UI periodically
      this.updateUI();
    } else if (this.gameState === 'menu') {
      // Animate menu state - rotate camera slightly
      const t = this.clock.elapsedTime;
      this.camera.position.x = 18 * Math.cos(t * 0.1);
      this.camera.position.z = 18 * Math.sin(t * 0.1);
      this.camera.lookAt(0, 0, -2);
    }
    
    // Render with post-processing
    this.composer.render();
  }

  startGame() {
    this.gameState = 'playing';
    this.loadGame();
    this.soundEngine.playWaveStart();
  }
}

// Initialize game when DOM is ready
const game = new SpaceInvadersGame();
game.init();

// Handle keyboard shortcuts for menu/game transitions
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    if (game.gameState === 'menu' || game.gameState === 'gameover') {
      game.startGame();
    }
  }
});
