import * as THREE from 'three';
import { InputManager } from '../../shared/input/InputManager.js';
import { AudioEngine } from '../../shared/audio/AudioEngine.js';
import { CameraShake } from '../../shared/vfx/CameraShake.js';
import { ParticleManager } from '../../shared/vfx/ParticleManager.js';
import { ShockwaveRing } from '../../shared/vfx/ShockwaveRing.js';
import { FloatingScoreText } from '../../shared/vfx/FloatingScoreText.js';
import { HitStop } from '../../shared/vfx/HitStop.js';
import { PostProcessingStack } from '../../shared/rendering/PostProcessingStack.js';
import { GeometryFactory } from '../../shared/rendering/GeometryFactory.js';
import { PlayerEntity } from './entities/PlayerEntity.js';
import { ProjectileEntity } from './entities/ProjectileEntity.js';
import { UFOEntity } from './entities/UFOEntity.js';
import type { InvaderGridCell } from './systems/SpawnerSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { LevelManager } from './systems/LevelManager.js';
import { ARENA_WIDTH, PLAYER_Y, INVADER_COLS, INVADER_ROWS } from './constants.js';

interface InvaderCellData {
  mesh: THREE.Mesh;
  alive: boolean;
  row: number;
  col: number;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private input: InputManager;
  private audio: AudioEngine;
  private clock: THREE.Clock;
  private animationId: number | null = null;

  // VFX systems
  private cameraShake: CameraShake;
  private particleManager: ParticleManager;
  private shockwaveRing: ShockwaveRing;
  private floatingScoreText: FloatingScoreText;
  private hitStop: HitStop;
  private postProcessing: PostProcessingStack;

  // Game entities
  private player: PlayerEntity;
  private projectiles: ProjectileEntity;
  private ufo: UFOEntity;

  // Systems
  private collision: CollisionSystem;
  private levelManager: LevelManager;

  // Grid state
  private invaderGrid: InvaderCellData[] = [];
  private playerProjectiles: THREE.Mesh[] = [];
  private enemyProjectiles: THREE.Mesh[] = [];
  private invaderDirection: number = 1;
  private stepSpeed: number = 0.3;

  // UFO state
  private ufoTimer: number = 0;
  private ufoInterval: number = 25;

  // State
  private gameOver: boolean = false;
  private levelTransition: boolean = false;
  private transitionTimer: number = 0;

  constructor() {
    this.clock = new THREE.Clock();
    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initInput();
    this.initAudio();
    this.initVFXSystems();
    this.initPostProcessing();
    this.initGameEntities();
    this.initLevelManager();
    this.initStarfield();
    this.initGridFloor();
  }

  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.body.appendChild(this.renderer.domElement);
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050510);
    this.scene.fog = new THREE.FogExp2(0x050510, 0.015);
  }

  private initCamera(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      45,
      aspect,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 18);
    this.camera.lookAt(0, 0, 0);
  }

  private initInput(): void {
    this.input = new InputManager();
    this.input.startPolling();
  }

  private initAudio(): void {
    this.audio = new AudioEngine();
  }

  private initVFXSystems(): void {
    this.cameraShake = new CameraShake(this.camera);
    this.particleManager = new ParticleManager(this.scene);
    this.shockwaveRing = new ShockwaveRing(this.scene);
    this.floatingScoreText = new FloatingScoreText(this.scene, this.camera);
    this.hitStop = new HitStop();
  }

  private initPostProcessing(): void {
    this.postProcessing = new PostProcessingStack(
      this.renderer,
      this.scene,
      this.camera
    );
  }

  private initGameEntities(): void {
    this.player = new PlayerEntity(this.input, this.audio);
    this.projectiles = new ProjectileEntity();
    this.ufo = new UFOEntity();
    this.collision = new CollisionSystem();
  }

  private initLevelManager(): void {
    this.levelManager = new LevelManager(
      this.scene,
      this.audio,
      this.cameraShake,
      this.particleManager,
      this.shockwaveRing,
      this.floatingScoreText
    );
  }

  private initStarfield(): void {
    const starfield = GeometryFactory.createStarfield(500);
    this.scene.add(starfield);
  }

  private initGridFloor(): void {
    const gridFloor = GeometryFactory.createGridFloor(60, 40, 40);
    this.scene.add(gridFloor);
  }

  public start(): void {
    this.buildInitialGrid();
    this.input.gamepad.startPolling();
    this.updateHUD();
    this.gameLoop();
  }

  private buildInitialGrid(): void {
    for (let row = 0; row < INVADER_ROWS; row++) {
      const rowType = row < 1 ? 0 : row < 3 ? 1 : 2;
      for (let col = 0; col < INVADER_COLS; col++) {
        this.addInvaderCell(row, col, rowType);
      }
    }
  }

  private addInvaderCell(row: number, col: number, rowType: number): InvaderGridCell {
    const x = -((INVADER_COLS - 1) * 0.7) / 2 + col * 0.7;
    const y = 4.5 - row * 0.6;

    let geo: THREE.BufferGeometry;
    switch (rowType) {
      case 0:
        geo = new THREE.IcosahedronGeometry(0.25, 0);
        break;
      case 1:
        geo = new THREE.OctahedronGeometry(0.25, 0);
        break;
      default:
        geo = new THREE.IcosahedronGeometry(0.28, 1);
    }

    const color = rowType === 0 ? 0x00ff88 : rowType === 1 ? 0x00ccff : 0xff66aa;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.7,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 0);
    this.scene.add(mesh);

    const cell: InvaderGridCell = { mesh, alive: true, row, col };
    this.invaderGrid.push(cell);
    return cell;
  }

  private gameLoop = (): void => {
    this.animationId = requestAnimationFrame(this.gameLoop);

    const rawDt = Math.min(this.clock.getDelta(), 0.05); // Cap delta to avoid spiral of death
    const effectiveDt = this.hitStop.isActive ? rawDt * this.hitStop.timescale : rawDt;

    // Update hit-stop counter first
    this.hitStop.update(rawDt);

    if (this.levelTransition) {
      this.transitionTimer -= rawDt;
      if (this.transitionTimer <= 0) {
        this.levelTransition = false;
        this.resetLevel();
      }
      this.updateVFX(effectiveDt);
      this.postProcessing.render();
      return;
    }

    if (!this.gameOver) {
      this.updatePlayer(effectiveDt);
      this.updateInvaders(effectiveDt);
      this.updateProjectiles(effectiveDt);
      this.updateUFO(effectiveDt);
      this.checkCollisions();
      this.updateVFX(effectiveDt);
    }

    // Render
    this.postProcessing.render();
  };

  private updatePlayer(dt: number): void {
    if (!this.player || !this.player.isAlive()) return;
    const result = this.player.update(dt);
    if (result && result.projectile) {
      this.playerProjectiles.push(result.projectile);
    }
  }

  private updateInvaders(dt: number): void {
    // Enemy fire from spawner system
    const projResult = this.spawnEnemyProjectile(dt);
    if (projResult) {
      this.enemyProjectiles.push(projResult);
    }

    // Check invader bounds for direction change
    const aliveCells = this.invaderGrid.filter(c => c.alive);
    let hitEdge = false;
    for (const cell of aliveCells) {
      if (this.invaderDirection > 0 && cell.mesh.position.x > ARENA_WIDTH / 2 - 0.5) {
        hitEdge = true;
        break;
      }
      if (this.invaderDirection < 0 && cell.mesh.position.x < -ARENA_WIDTH / 2 + 0.5) {
        hitEdge = true;
        break;
      }
    }

    if (hitEdge) {
      this.invaderDirection *= -1;
      for (const cell of aliveCells) {
        cell.mesh.position.y -= 0.15;
      }
      this.levelManager.triggerCameraShake(0.1);
    }

    // Check if invaders reached bottom
    for (const cell of aliveCells) {
      if (cell.mesh.position.y < -6) {
        this.gameOver = true;
        this.audio.playPlayerHit();
        break;
      }
    }

    // Check level complete
    if (aliveCells.length === 0 && !this.levelTransition) {
      this.levelComplete();
    }
  }

  private spawnEnemyProjectile(dt: number): THREE.Mesh | null {
    const aliveCells = this.invaderGrid.filter(c => c.alive);
    if (aliveCells.length === 0 || Math.random() > dt * 1.5) return null;

    const shooter = aliveCells[Math.floor(Math.random() * aliveCells.length)];
    const projGeo = new THREE.BoxGeometry(0.08, 0.08, 0.4);
    const projMat = new THREE.MeshStandardMaterial({
      color: 0xff3366,
      emissive: 0xff3366,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.9,
    });
    const proj = new THREE.Mesh(projGeo, projMat);
    proj.position.set(shooter.mesh.position.x, shooter.mesh.position.y - 0.2, 0);
    (proj.userData as any).velocity = new THREE.Vector3(0, -8, 0);
    (proj.userData as any).isPlayerProjectile = false;
    (proj.userData as any).damage = 1;
    return proj;
  }

  private updateProjectiles(dt: number): void {
    this.projectiles.update(dt);

    // Remove off-screen projectiles
    this.playerProjectiles = this.playerProjectiles.filter(p => {
      if (!p.visible || p.position.y > 10) return false;
      return true;
    });

    this.enemyProjectiles = this.enemyProjectiles.filter(p => {
      if (!p.visible || p.position.y < -8) return false;
      return true;
    });
  }

  private updateUFO(dt: number): void {
    if (this.ufo.isActive) {
      this.ufo.update(dt);
    } else {
      this.ufoTimer += dt;
      if (this.ufoTimer >= this.ufoInterval) {
        const startX = Math.random() > 0.5 ? -10 : 10;
        this.ufo.spawn(startX);
        this.audio.playUfoAppear();
        this.ufoTimer = 0;
        this.ufoInterval = 15 + Math.random() * 20;
      }
    }
  }

  private checkCollisions(): void {
    const result = this.collision.check(
      this.playerProjectiles,
      this.enemyProjectiles,
      this.invaderGrid
    );

    // Handle destroyed invaders
    for (const mesh of result.destroyed) {
      const cell = this.invaderGrid.find(c => c.mesh === mesh);
      if (cell) {
        const row = cell.row;
        let score = 10;
        if (row < 1) score = 30;
        else if (row < 3) score = 20;

        this.levelManager.addScore(score, { x: mesh.position.x, y: mesh.position.y, z: 0 });
        const color = row < 1 ? 0x00ff88 : row < 3 ? 0x00ccff : 0xff66aa;
        this.levelManager.spawnExplosionParticles(
          { x: mesh.position.x, y: mesh.position.y, z: 0 },
          color
        );
        this.levelManager.spawnShockwave(
          { x: mesh.position.x, y: mesh.position.y, z: 0 },
          color
        );
        this.audio.playExplosion();
        this.levelManager.triggerCameraShake(0.15);

        // Clean up the destroyed mesh
        this.scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if ((mesh.material as THREE.Material).dispose) {
          (mesh.material as THREE.Material).dispose();
        }
      }
    }

    // Handle player hit by enemy projectile
    if (result.enemyProjectiles.length > 0 && this.player.isAlive()) {
      for (const proj of result.enemyProjectiles) {
        this.player.takeDamage();
        this.audio.playPlayerHit();
        this.levelManager.triggerCameraShake(0.4);
        this.hitStop.trigger(6);
        this.levelManager.spawnExplosionParticles(
          { x: this.player.position.x, y: this.player.position.y, z: 0 },
          0x00ffff
        );

        if (this.levelManager.gameOver) {
          setTimeout(() => this.showGameOver(), 1500);
        } else {
          setTimeout(() => {
            if (this.player.isAlive()) return; // Already resurrected
            this.player.reset(new THREE.Vector3(0, PLAYER_Y, 0));
          }, 1500);
        }

        // Clean up the projectile that hit us
        this.scene.remove(proj);
        if (proj.geometry) proj.geometry.dispose();
        if ((proj.material as THREE.Material).dispose) {
          (proj.material as THREE.Material).dispose();
        }
      }
    }

    // Handle UFO collision
    if (this.ufo.isActive && this.collision.checkUFOCollision(
      true,
      this.ufo.position,
      this.playerProjectiles
    )) {
      const ufoScore = this.ufo.scoreValue;
      this.levelManager.addScore(ufoScore, { x: this.ufo.position.x, y: this.ufo.position.y, z: 0 });
      this.audio.playUfoLaser(); // Use explosion sound for UFO death
      this.levelManager.spawnExplosionParticles(
        { x: this.ufo.position.x, y: this.ufo.position.y, z: 0 },
        0xff00ff
      );
      this.levelManager.triggerCameraShake(0.5);
      this.hitStop.trigger(4);
      this.ufo.despawn();
    }

    // Clean up destroyed player projectiles (hit invaders)
    for (const proj of result.destroyed) {
      const idx = this.playerProjectiles.indexOf(proj);
      if (idx !== -1) {
        this.scene.remove(proj);
        if (proj.geometry) proj.geometry.dispose();
        if ((proj.material as THREE.Material).dispose) {
          (proj.material as THREE.Material).dispose();
        }
        this.playerProjectiles.splice(idx, 1);
      }
    }

    // Clean up enemy projectiles that hit invaders
    for (const proj of result.enemyProjectiles) {
      const idx = this.enemyProjectiles.indexOf(proj);
      if (idx !== -1) {
        this.scene.remove(proj);
        if (proj.geometry) proj.geometry.dispose();
        if ((proj.material as THREE.Material).dispose) {
          (proj.material as THREE.Material).dispose();
        }
        this.enemyProjectiles.splice(idx, 1);
      }
    }
  }

  private updateVFX(dt: number): void {
    this.cameraShake.update(dt);
    this.particleManager.update(dt);
    this.shockwaveRing.update(dt);
    this.floatingScoreText.update(dt);
    this.postProcessing.update(this.clock.getElapsedTime());
  }

  private levelComplete(): void {
    this.levelTransition = true;
    this.transitionTimer = 2.0;
    this.audio.playPowerup();
    this.levelManager.levelComplete();
  }

  private resetLevel(): void {
    // Remove old invader meshes from scene
    for (const cell of this.invaderGrid) {
      this.scene.remove(cell.mesh);
      if (cell.mesh.geometry) cell.mesh.geometry.dispose();
      if ((cell.mesh.material as THREE.Material).dispose) {
        (cell.mesh.material as THREE.Material).dispose();
      }
    }
    this.invaderGrid = [];
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.ufo.despawn();
    this.ufoTimer = 0;

    // Rebuild grid for new level
    const config = this.levelManager.getLevelConfig();
    this.stepSpeed = config.invaderSpeed;

    for (let row = 0; row < INVADER_ROWS; row++) {
      const rowType = row < 1 ? 0 : row < 3 ? 1 : 2;
      for (let col = 0; col < INVADER_COLS; col++) {
        this.addInvaderCell(row, col, rowType);
      }
    }

    // Reset player position
    if (this.player.isAlive()) {
      this.player.reset(new THREE.Vector3(0, PLAYER_Y, 0));
    }
  }

  private showGameOver(): void {
    const overlay = document.getElementById('game-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      const text = document.getElementById('overlay-text');
      if (text) {
        text.innerHTML = `
          <h1>GAME OVER</h1>
          <p>Final Score: ${this.levelManager.score}<br>High Score: ${this.levelManager.highScore}</p>
          <button id="restart-btn">PLAY AGAIN</button>
        `;
        document.getElementById('restart-btn')?.addEventListener('click', () => {
          this.restart();
        });
      }
    }
  }

  private restart(): void {
    const overlay = document.getElementById('game-overlay');
    if (overlay) overlay.classList.add('hidden');

    // Reset game state
    this.gameOver = false;
    this.levelTransition = false;
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.ufo.despawn();
    this.ufoTimer = 0;

    // Reset player
    if (this.player.isAlive()) {
      this.player.reset(new THREE.Vector3(0, PLAYER_Y, 0));
    } else {
      this.player.reset(new THREE.Vector3(0, PLAYER_Y, 0));
    }
    this.levelManager.resetGame();
    this.updateHUD();

    // Rebuild invader grid for new level
    this.invaderGrid = [];
    for (let row = 0; row < INVADER_ROWS; row++) {
      const rowType = row < 1 ? 0 : row < 3 ? 1 : 2;
      for (let col = 0; col < INVADER_COLS; col++) {
        this.addInvaderCell(row, col, rowType);
      }
    }
  }

  private updateHUD(): void {
    const scoreDisplay = document.getElementById('score-display');
    if (scoreDisplay) {
      scoreDisplay.textContent = String(this.levelManager.score);
    }

    const livesDisplay = document.getElementById('lives-display');
    if (livesDisplay) {
      let livesHTML = '';
      for (let i = 0; i < this.levelManager.lives; i++) {
        livesHTML += '<span style="color: #0ff;">&#9679;</span> ';
      }
      livesDisplay.innerHTML = `LIVES: ${livesHTML}`;
    }

    const levelDisplay = document.getElementById('level-display');
    if (levelDisplay) {
      levelDisplay.textContent = `LEVEL ${this.levelManager.level}`;
    }
  }

  public dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.input.stopPolling();
    this.audio.dispose();
    this.particleManager.dispose();
    this.shockwaveRing.dispose();
    this.floatingScoreText.dispose();
    this.postProcessing.dispose();

    // Clean up scene objects
    this.scene.traverse((child) => {
      const obj = child as THREE.Object3D;
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach(m => m.dispose());
          else mat.dispose();
        }
      }
    });

    window.removeEventListener('resize', this.handleResize);
  }

  public handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.postProcessing.setSize(width, height);
  };
}

// Bootstrap
const game = new Game();
game.start();

window.addEventListener('resize', () => game.handleResize());
