/**
 * Space Invaders — Core game loop, state machine, and entity management.
 * States: MENU → PLAYING → WAVE_TRANSITION → GAME_OVER
 */

import {
  Scene, PerspectiveCamera, Vector3, Color,
  BufferGeometry, Float32BufferAttribute, PointsMaterial, Points,
  GridHelper, PlaneGeometry, MeshStandardMaterial, Mesh,
  PointLight, Group,
} from 'three';
import type { Synth } from '@shared/audio/Synth';
import type { MusicEngine } from '@shared/audio/MusicEngine';
import type { InputManager } from '@shared/input/InputManager';
import type { ParticleManager } from '@shared/vfx/ParticleManager';
import type { CameraShake } from '@shared/vfx/CameraShake';
import type { HitStop } from '@shared/vfx/HitStop';
import type { ShockwaveRings } from '@shared/vfx/ShockwaveRings';
import type { FloatingText } from '@shared/vfx/FloatingText';
import type { MotionTrails } from '@shared/vfx/MotionTrails';
import type { UIOverlay } from '@shared/ui/UIOverlay';
import { PlayerShip } from './entities/PlayerShip';
import { AlienFormation } from './entities/AlienFormation';
import { Projectile } from './entities/Projectile';
import { ShieldBarrier, ShieldVoxel } from './entities/Shield';
import { UFO } from './entities/UFO';
import { CollisionSystem, type CollisionCallbacks } from './systems/CollisionSystem';
import { ScoringSystem } from './systems/ScoringSystem';
import {
  PLAYER_SPEED, PROJECTILE_SPEED, ALIEN_DROP_DISTANCE, ALIEN_SPEED_MIN,
  SCREEN_LEFT, SCREEN_RIGHT, PLAYER_Y, PLAYER_Z,
  MAX_PLAYER_PROJECTILES, MAX_ALIEN_BULLETS, TOTAL_ALIENS,
  UFO_SPAWN_INTERVAL_MIN, UFO_SPAWN_INTERVAL_MAX,
} from '@shared/utils/Constants';

export type GameState = 'MENU' | 'PLAYING' | 'WAVE_TRANSITION' | 'GAME_OVER';

export class Game implements CollisionCallbacks {
  private scene: Scene;
  private camera: PerspectiveCamera;

  // Systems
  private inputManager!: InputManager;
  private synth!: Synth;
  private musicEngine!: MusicEngine;
  private particleManager!: ParticleManager;
  private cameraShake!: CameraShake;
  private hitStop!: HitStop;
  private shockwaveRings!: ShockwaveRings;
  private floatingText!: FloatingText;
  private motionTrails!: MotionTrails;
  private uiOverlay!: UIOverlay;

  // Entities
  private playerShip!: PlayerShip;
  private alienFormation!: AlienFormation;
  private projectiles: Projectile[] = [];
  private shields: Array<{ group: ShieldBarrier; position: Vector3 }> = [];
  private ufo!: UFO;
  private collisionSystem!: CollisionSystem;
  private scoringSystem!: ScoringSystem;

  // Game state
  private gameState: GameState = 'MENU';
  private score: number = 0;
  private lives: number = 3;
  private wave: number = 1;
  private highScore: number = parseInt(localStorage.getItem('spaceInvaders_highScore') || '0', 10);

  // Wave transition timing
  private waveTransitionTimer: number = 0;
  private waveTransitionDuration: number = 2.5;

  // UFO spawning
  private ufoSpawnTimer: number = 0;
  private ufoSpawnInterval: number = 20;

  // Starfield background
  private starField: any = null;

  // Grid floor
  private gridFloor: any = null;

  constructor(scene: Scene, camera: PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
  }

  /** Initialize all systems and entities */
  init(
    inputManager: InputManager,
    synth: Synth,
    musicEngine: MusicEngine,
    particleManager: ParticleManager,
    cameraShake: CameraShake,
    hitStop: HitStop,
    shockwaveRings: ShockwaveRings,
    floatingText: FloatingText,
    motionTrails: MotionTrails,
    uiOverlay: UIOverlay
  ): void {
    this.inputManager = inputManager;
    this.synth = synth;
    this.musicEngine = musicEngine;
    this.particleManager = particleManager;
    this.cameraShake = cameraShake;
    this.hitStop = hitStop;
    this.shockwaveRings = shockwaveRings;
    this.floatingText = floatingText;
    this.motionTrails = motionTrails;
    this.uiOverlay = uiOverlay;

    // Build starfield background
    this.buildStarField();

    // Build grid floor
    this.buildGridFloor();

    // Reset game state
    this.resetGame();
  }

  /** Build procedural starfield background */
  private buildStarField(): void {
    const count = 300;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Spread across a sphere of radius ~40
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 35 + Math.random() * 10;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));

    const material = new PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });

    this.starField = new Points(geometry, material);
    this.scene.add(this.starField);
  }

  /** Build Tron-style grid floor */
  private buildGridFloor(): void {
    const gridSize = 30;
    const gridDivisions = 30;
    const gridHelper = new GridHelper(gridSize, gridDivisions, 0x00ffff, 0x004466);
    gridHelper.position.y = -4;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.5;
    this.gridFloor = gridHelper;
    this.scene.add(this.gridFloor);

    // Reflection hint — inverted plane below
    const reflGeo = new PlaneGeometry(gridSize, gridSize);
    const reflMat = new MeshStandardMaterial({
      color: 0x001122,
      emissive: 0x00ffff,
      emissiveIntensity: 0.1,
      transparent: true,
      opacity: 0.3,
      metalness: 0.9,
      roughness: 0.5,
    });
    const reflPlane = new Mesh(reflGeo, reflMat);
    reflPlane.rotation.x = -Math.PI / 2;
    reflPlane.position.y = -4.01;
    this.scene.add(reflPlane);
  }

  /** Reset all game state for a fresh start */
  private resetGame(): void {
    // Remove old entities from scene
    if (this.playerShip) this.scene.remove(this.playerShip.mesh);
    if (this.alienFormation) this.alienFormation.dispose();
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const s of this.shields) {
      this.scene.remove(s.group.getGroup());
      s.group.dispose();
    }
    if (this.ufo) this.scene.remove(this.ufo.mesh);

    // Clear arrays
    this.projectiles.length = 0;
    this.shields.length = 0;

    // Reset scoring
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.highScore = parseInt(localStorage.getItem('spaceInvaders_highScore') || '0', 10);

    // Create player ship
    this.playerShip = new PlayerShip(
      PLAYER_SPEED, SCREEN_LEFT + 1, SCREEN_RIGHT - 1, PLAYER_Y, PLAYER_Z, this.synth
    );
    this.scene.add(this.playerShip.mesh);

    // Create alien formation
    this.alienFormation = new AlienFormation();
    for (const alien of this.alienFormation.getAliveAliens()) {
      this.scene.add(alien.mesh);
    }

    // Create shields
    const shieldPositions = [-6, -2, 2, 6];
    for (const sx of shieldPositions) {
      const barrier = new ShieldBarrier();
      barrier.setPosition(sx, -1.5, -1);
      this.scene.add(barrier.getGroup());
      this.shields.push({ group: barrier, position: new Vector3(sx, -1.5, -1) });
    }

    // Create UFO
    this.ufo = new UFO();
    this.ufo.deactivate();
    this.scene.add(this.ufo.mesh);

    // Build collision system
    const aliens = this.alienFormation.getAliveAliens();
    this.collisionSystem = new CollisionSystem(
      this,
      this.playerShip,
      aliens,
      this.projectiles,
      this.shields.map(s => ({ group: s.group, position: s.position })),
      this.ufo
    );

    // Build scoring system
    this.scoringSystem = new ScoringSystem(this.synth, this.floatingText);

    // Update UI
    this.uiOverlay.updateScore(0);
    this.uiOverlay.updateLives(3);
    this.uiOverlay.updateWave(1);
    this.uiOverlay.hideGameOver();
    this.uiOverlay.hideWaveTransition();

    // Reset game state
    this.gameState = 'MENU';
    this.ufoSpawnTimer = 0;
    this.hitStop.reset();
    this.cameraShake.reset();
  }

  /** Start a new game */
  startGame(): void {
    this.resetGame();
    this.gameState = 'PLAYING';
    this.musicEngine.start();
    this.musicEngine.setIntensity(0.5);
  }

  // ─── Collision Callbacks (from CollisionCallbacks interface) ──────────────

  onAlienHit(alienRow: number, alienCol: number): void {
    if (this.gameState !== 'PLAYING') return;

    const aliens = this.alienFormation.getAliveAliens();
    const alien = aliens.find(a => a.row === alienRow && a.col === alienCol);
    if (!alien) return;

    // Add points
    this.scoringSystem.addAlienPoints(alienRow, alienCol, alien.position.clone());
    this.score = this.scoringSystem.getScore();
    this.uiOverlay.updateScore(this.score);

    // VFX: explosion particles
    const colorHex = alien.type === 0 ? 0xff00ff : (alien.type <= 2 ? 0x00ffff : 0x00ff88);
    this.particleManager.burst(
      alien.position.clone(), 25, colorHex, 1.5, 4, 0.6, 1.2
    );

    // VFX: camera shake
    const speedMult = 1 + (TOTAL_ALIENS - this.alienFormation.getAliveCount()) / TOTAL_ALIENS * 2.5;
    this.cameraShake.addTrauma(0.12 * speedMult);

    // VFX: shockwave ring
    this.shockwaveRings.spawn(alien.position.clone(), colorHex, 'small');

    // VFX: floating score text (also handled by ScoringSystem)

    // VFX: temporary point light at explosion
    const light = new PointLight(colorHex, 3, 8);
    light.position.copy(alien.position);
    this.scene.add(light);
    setTimeout(() => {
      this.scene.remove(light);
      if (light.dispose) light.dispose();
    }, 400);

    // Mark alien as destroyed
    this.alienFormation.destroyAlien(alienRow, alienCol);
    alien.deactivate();

    // Update music intensity based on remaining aliens
    const ratio = this.alienFormation.getAliveCount() / TOTAL_ALIENS;
    this.musicEngine.setIntensity(0.3 + (1 - ratio) * 0.7);

    // Check wave complete
    if (this.alienFormation.isAllDestroyed()) {
      this.startWaveTransition();
    }
  }

  onPlayerHit(): void {
    if (this.gameState !== 'PLAYING') return;

    // VFX: hit-stop freeze
    this.hitStop.trigger(0.15);

    // VFX: camera shake
    this.cameraShake.addTrauma(0.3);

    // VFX: shockwave ring
    this.shockwaveRings.spawn(this.playerShip.position.clone(), 0xff4444, 'large');

    // VFX: particles
    this.particleManager.burst(
      this.playerShip.position.clone(), 20, 0xff4444, 1, 3, 0.5, 1.0
    );

    // SFX
    this.synth.playPlayerHit();

    // Lose a life
    if (this.playerShip.takeDamage()) {
      this.lives = this.playerShip.lives;
      this.uiOverlay.updateLives(this.lives);
      this.scoringSystem.resetCombo();

      if (this.lives <= 0) {
        this.gameState = 'GAME_OVER';
        this.musicEngine.stop();
        this.synth.playGameOver();
        this.uiOverlay.showGameOver(this.score, this.highScore);
      } else {
        // Respawn player at center with invulnerability
        this.playerShip.reset();
      }
    }
  }

  onShieldHit(voxel: ShieldVoxel | null, shieldIndex: number): void {
    if (this.gameState !== 'PLAYING') return;

    if (voxel) {
      // SFX: shield crackle
      this.synth.playShieldHit();

      // VFX: sparks at hit position
      const pos = voxel.mesh.position.clone();
      pos.add(this.shields[shieldIndex].position);
      this.particleManager.burst(pos, 6, 0xffaa44, 1, 2.5, 0.2, 0.5);

      // Destroy the voxel
      voxel.takeDamage();
    }
  }

  onUFOHit(points: number): void {
    if (this.gameState !== 'PLAYING') return;

    const ufoPos = this.ufo.position.clone();
    this.scoringSystem.addUFOPoints(points, ufoPos);
    this.score = this.scoringSystem.getScore();
    this.uiOverlay.updateScore(this.score);

    // VFX: explosion particles (red for UFO)
    this.particleManager.burst(ufoPos, 30, 0xff4444, 2, 5, 0.8, 1.5);

    // VFX: camera shake
    this.cameraShake.addTrauma(0.2);

    // VFX: shockwave ring (larger for UFO)
    this.shockwaveRings.spawn(ufoPos, 0xff4444, 'large');

    // SFX
    this.synth.playExplosion();

    // Deactivate UFO
    this.ufo.deactivate();
  }

  // ─── Game Loop ────────────────────────────────────────────────────────────

  /** Main update called every frame by the Engine */
  update(dt: number): void {
    // Apply hit-stop timescale
    const effectiveDt = dt * this.hitStop.getTimescale();
    this.hitStop.update(dt);

    if (this.gameState === 'MENU') {
      this.handleMenuInput(effectiveDt);
      return;
    }

    if (this.gameState === 'GAME_OVER') {
      this.handleGameOverInput(effectiveDt);
      return;
    }

    if (this.gameState === 'WAVE_TRANSITION') {
      this.updateWaveTransition(effectiveDt);
      return;
    }

    // ─── PLAYING STATE ──────────────────────────────────────────────────

    // Poll input
    const poll = this.inputManager.poll();
    const moveLeft = poll['moveLeft'];
    const moveRight = poll['moveRight'];
    const fire = poll['fire'];

    // Update player ship
    this.playerShip.update(effectiveDt, moveLeft, moveRight);

    // Handle shooting
    if (fire && this.playerShip.tryFire()) {
      this.firePlayerProjectile();
    }

    // Update existing projectiles
    for (const proj of this.projectiles) {
      proj.update(effectiveDt);

      // Remove off-screen projectiles
      if (proj.active) {
        const pos = proj.mesh.position;
        if (pos.y > 10 || pos.y < -6 || pos.x < SCREEN_LEFT - 2 || pos.x > SCREEN_RIGHT + 2) {
          proj.deactivate();
        }
      }
    }

    // Update alien formation
    this.alienFormation.update(effectiveDt);

    // Alien shooting — limit to MAX_ALIEN_BULLETS active
    const activeAlienBullets = this.projectiles.filter(p => p.active && p.owner === 'alien').length;
    if (activeAlienBullets < MAX_ALIEN_BULLETS) {
      const shots = this.alienFormation.tryFireShots();
      for (const shot of shots) {
        if (this.projectiles.filter(p => p.active).length >= 250) break; // pool safety
        const proj = new Projectile();
        proj.activate(shot.position, shot.velocity, 'alien');
        this.scene.add(proj.mesh);
        for (const t of proj.trailMeshes) this.scene.add(t);
        this.projectiles.push(proj);
      }
    }

    // Update UFO spawning and movement
    this.updateUFO(effectiveDt);

    // Check collisions
    const aliens = this.alienFormation.getAliveAliens();
    this.collisionSystem = new CollisionSystem(
      this,
      this.playerShip,
      aliens,
      this.projectiles,
      this.shields.map(s => ({ group: s.group, position: s.position })),
      this.ufo.active ? this.ufo : undefined
    );
    this.collisionSystem.checkAll();

    // Update VFX systems
    this.cameraShake.update(effectiveDt);
    this.particleManager.update(effectiveDt);
    this.shockwaveRings.update(effectiveDt);
    this.floatingText.update(effectiveDt);

    // Apply camera shake to camera position (CameraShake modifies in-place)
    this.cameraShake.apply(this.camera);

    // Update starfield rotation for parallax
    if (this.starField) {
      this.starField.rotation.y += effectiveDt * 0.02;
    }

    // Follow player with camera (subtle)
    const targetCamX = this.playerShip.position.x * 0.15;
    this.camera.position.x += (targetCamX - this.camera.position.x) * 0.03;
  }

  /** Fire a player projectile */
  private firePlayerProjectile(): void {
    // Count active player projectiles — max 3
    const activeCount = this.projectiles.filter(p => p.active && p.owner === 'player').length;
    if (activeCount >= MAX_PLAYER_PROJECTILES) return;

    const proj = new Projectile();
    const shootPos = new Vector3(
      this.playerShip.position.x,
      this.playerShip.position.y + 0.6,
      this.playerShip.position.z
    );
    const velocity = new Vector3(0, PROJECTILE_SPEED, 0);
    proj.activate(shootPos, velocity, 'player');

    this.scene.add(proj.mesh);
    for (const t of proj.trailMeshes) this.scene.add(t);
    this.projectiles.push(proj);

    // SFX
    this.synth.playShoot();
  }

  /** Update UFO spawning logic */
  private updateUFO(dt: number): void {
    if (!this.ufo.active && this.gameState === 'PLAYING') {
      this.ufoSpawnTimer += dt;
      if (this.ufoSpawnTimer >= this.ufoSpawnInterval) {
        this.ufoSpawnTimer = 0;
        // Random interval for next spawn
        this.ufoSpawnInterval = UFO_SPAWN_INTERVAL_MIN + Math.random() * (UFO_SPAWN_INTERVAL_MAX - UFO_SPAWN_INTERVAL_MIN);

        // Spawn from random side
        const x = Math.random() > 0.5 ? SCREEN_LEFT - 1 : SCREEN_RIGHT + 1;
        this.ufo.activate(x);
        this.synth.playUFOBeep();
      }
    }

    if (this.ufo.active) {
      this.ufo.update(dt);
    }
  }

  /** Handle wave transition cinematic */
  private updateWaveTransition(dt: number): void {
    this.waveTransitionTimer += dt;

    // Camera zoom effect — slowly pull back then return
    const progress = this.waveTransitionTimer / this.waveTransitionDuration;
    if (progress < 0.5) {
      // Zoom out phase
      const t = progress * 2; // 0 to 1
      this.camera.position.z = 16 + Math.sin(t * Math.PI * 0.5) * 4;
    } else {
      // Return phase
      const t = (progress - 0.5) * 2; // 0 to 1
      this.camera.position.z = 20 - Math.sin(t * Math.PI * 0.5) * 4;
    }

    if (this.waveTransitionTimer >= this.waveTransitionDuration) {
      // Transition complete — start next wave
      this.startNextWave();
    }
  }

  /** Start the wave transition cinematic */
  private startWaveTransition(): void {
    this.gameState = 'WAVE_TRANSITION';
    this.waveTransitionTimer = 0;
    this.musicEngine.stop();
    this.synth.playWaveComplete();
    this.uiOverlay.showWaveTransition(this.wave + 1);

    // VFX: big shockwave from center
    this.shockwaveRings.spawn(new Vector3(0, -2, -2), 0x00ffff, 'large');
    this.cameraShake.addTrauma(0.2);
  }

  /** Start the next wave with increased difficulty */
  private startNextWave(): void {
    this.wave++;
    this.uiOverlay.updateWave(this.wave);

    // Reset formation with new difficulty
    this.alienFormation.dispose();
    for (const child of this.scene.children) {
      if (child instanceof Group) {
        // Remove alien meshes — they're in groups we added
      }
    }

    // Rebuild alien formation
    this.alienFormation = new AlienFormation(ALIEN_SPEED_MIN + (this.wave - 1) * 0.15);
    for (const alien of this.alienFormation.getAliveAliens()) {
      this.scene.add(alien.mesh);
    }

    // Update collision system with new aliens
    const aliens = this.alienFormation.getAliveAliens();
    this.collisionSystem = new CollisionSystem(
      this,
      this.playerShip,
      aliens,
      this.projectiles,
      this.shields.map(s => ({ group: s.group, position: s.position })),
      this.ufo.active ? this.ufo : undefined
    );

    // Reset game state for new wave
    this.gameState = 'PLAYING';
    this.uiOverlay.hideWaveTransition();
    this.musicEngine.start();
    this.musicEngine.setIntensity(0.5);

    // VFX: camera shake on wave start
    this.cameraShake.addTrauma(0.15);
  }

  /** Handle input during MENU state */
  private handleMenuInput(dt: number): void {
    const poll = this.inputManager.poll();
    if (poll['fire'] || poll['pause']) {
      this.startGame();
    }
  }

  /** Handle input during GAME_OVER state */
  private handleGameOverInput(dt: number): void {
    const poll = this.inputManager.poll();
    if (poll['fire'] || poll['pause']) {
      this.resetGame();
      this.startGame();
    }
  }

  /** Render callback — called by Engine each frame */
  render(): void {
    // Apply camera shake offset
    this.cameraShake.apply(this.camera);

    // Use composer for post-processing if available
    const composer = (this as any)._composer;
    if (composer) {
      composer.render();
    } else {
      // Fallback: direct render
      const renderer = (this as any)._renderer;
      if (renderer) {
        renderer.render(this.scene, this.camera);
      }
    }
  }

  /** Dispose all resources — called on engine shutdown */
  dispose(): void {
    if (this.playerShip) {
      this.scene.remove(this.playerShip.mesh);
      this.playerShip.dispose();
    }
    if (this.alienFormation) {
      this.alienFormation.dispose();
    }
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      p.dispose();
    }
    for (const s of this.shields) {
      this.scene.remove(s.group.getGroup());
      s.group.dispose();
    }
    if (this.ufo) {
      this.scene.remove(this.ufo.mesh);
      this.ufo.dispose();
    }

    // Dispose starfield
    if (this.starField) {
      this.scene.remove(this.starField);
      if (this.starField.geometry) this.starField.geometry.dispose();
      if (this.starField.material) this.starField.material.dispose();
    }

    // Dispose grid floor
    if (this.gridFloor) {
      this.scene.remove(this.gridFloor);
    }

    this.projectiles.length = 0;
    this.shields.length = 0;

    this.musicEngine.stop();
    this.synth.reset();
  }
}
