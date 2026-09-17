import * as THREE from 'three';
import { GameEngine } from '../shared/core/GameEngine.js';
import { StateMachine } from '../shared/core/StateMachine.js';
import { CameraShake } from '../shared/vfx/CameraShake.js';
import { HitStop } from '../shared/vfx/HitStop.js';
import { ParticleManager } from '../shared/vfx/ParticleManager.js';
import { MotionTrail } from '../shared/vfx/MotionTrail.js';
import { ShockwaveRing } from '../shared/vfx/ShockwaveRing.js';
import { FloatingText } from '../shared/vfx/FloatingText.js';
import { Disposer } from '../shared/utils/Disposer.js';
import { AudioEngine } from '../shared/audio/AudioEngine.js';
import { SynthVoice } from '../shared/audio/SynthVoice.js';
import { SFXLibrary } from '../shared/audio/SFXLibrary.js';
import { CanvasTextureFactory } from '../shared/procgen/CanvasTextureFactory.js';
import { PostProcessingStack } from '../shared/postfx/PostProcessingStack.js';
import { lerp } from '../shared/utils/MathUtils.js';

import { PLAYFIELD, PLAYER, BUNKER } from './config/GameConfig.js';
import { Player } from './entities/Player.js';
import { EnemyFormation } from './entities/EnemyFormation.js';
import { ProjectileSystem, PROJECTILE_OWNER } from './entities/Projectile.js';
import { Bunker } from './entities/Bunker.js';
import { UFOBoss } from './entities/UFOBoss.js';
import { FormationMovementSystem } from './systems/FormationMovementSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { ScoringSystem } from './systems/ScoringSystem.js';
import { AudioDirector } from './systems/AudioDirector.js';
import { StarfieldFactory } from './procgen/StarfieldFactory.js';
import { ScanlineAberrationPass } from './postfx/ScanlineAberrationPass.js';
import { HUDOverlay } from './ui/HUDOverlay.js';
import { createInputManager, InputBindings } from './input/InputBindings.js';

const CHARGE_THRESHOLD = 0.35;
const CAMERA_BASE = { x: 0, y: 10, z: 15 };
const PROJECTILE_BOUNDS = {
  minZ: PLAYFIELD.formationStartZ - 6,
  maxZ: PLAYFIELD.playerZ + 4
};

/**
 * Top-level orchestrator. Owns every subsystem and drives the per-frame VFX
 * priority order: HitStop -> CameraShake -> input -> gameplay -> collisions
 * (which fan out into VFX/audio/score) -> particle/trail/ring/text update ->
 * render. See plan.md Section 4 for the full rationale.
 */
export class SpaceInvadersGame {
  constructor(rootContainer, canvas) {
    this._root = rootContainer;
    this._disposer = new Disposer();

    this._engine = new GameEngine({ canvas, cameraConfig: { fov: 50, near: 0.1, far: 200 } });
    this._camera = this._engine.camera;
    this._scene = this._engine.scene;
    this._renderer = this._engine.renderer;

    this._camera.position.set(CAMERA_BASE.x, CAMERA_BASE.y, CAMERA_BASE.z);
    this._camera.lookAt(0, 0, -2);

    this._setupLighting();
    this._setupGround();
    this._starfield = StarfieldFactory.build(this._scene, this._disposer);

    this._postfx = new PostProcessingStack(this._renderer, this._scene, this._camera, {
      bloomStrength: 0.7,
      bloomRadius: 0.4,
      bloomThreshold: 0.9
    });
    this._scanlinePass = new ScanlineAberrationPass(window.innerWidth, window.innerHeight);
    this._postfx.addCustomPass(this._scanlinePass);
    this._engine.onResize((w, h) => this._postfx.setSize(w, h));

    this._cameraShake = new CameraShake(this._camera);
    this._cameraShake.setBasePosition(CAMERA_BASE.x, CAMERA_BASE.y, CAMERA_BASE.z);
    this._hitStop = new HitStop();
    this._particles = new ParticleManager(this._scene, { disposer: this._disposer });
    this._motionTrail = new MotionTrail(this._scene, { disposer: this._disposer });
    this._shockwave = new ShockwaveRing(this._scene, { disposer: this._disposer, poolSize: 16 });
    this._floatingText = new FloatingText(this._root, this._camera, { poolSize: 24 });

    this._audioEngine = new AudioEngine();
    this._synthVoice = new SynthVoice(this._audioEngine);
    this._sfxLibrary = new SFXLibrary(this._synthVoice);
    this._audioDirector = new AudioDirector(this._audioEngine, this._synthVoice, this._sfxLibrary);

    this._player = new Player(this._scene, { disposer: this._disposer });
    this._formation = new EnemyFormation(this._scene, { disposer: this._disposer });
    this._projectiles = new ProjectileSystem(this._scene, {
      disposer: this._disposer,
      poolSize: 48,
      onDespawn: (instance) => this._motionTrail.unregister(instance.mesh)
    });
    this._ufoBoss = new UFOBoss(this._scene, this._projectiles, { disposer: this._disposer });
    this._motionTrail.register(this._ufoBoss.mesh, { color: 0x9b5bff, width: 0.35, segments: 16 });

    this._bunkers = [];
    this._resetBunkers();

    this._formationMovement = new FormationMovementSystem(this._formation);
    this._collision = new CollisionSystem({
      projectileSystem: this._projectiles,
      formation: this._formation,
      bunkers: this._bunkers,
      player: this._player,
      ufoBoss: this._ufoBoss
    });
    this._spawnSystem = new SpawnSystem({
      formation: this._formation,
      projectileSystem: this._projectiles,
      ufoBoss: this._ufoBoss
    });
    this._scoring = new ScoringSystem(this._floatingText);

    this._hud = new HUDOverlay(this._root);
    this._input = createInputManager();

    this._formationReachedPlayer = false;

    this._buildStateMachine();
  }

  _setupLighting() {
    const ambient = new THREE.AmbientLight(0x8899ff, 0.35);
    this._scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 12, 8);
    this._scene.add(key);

    const rim = new THREE.PointLight(0x9b5bff, 0.8, 40);
    rim.position.set(0, 6, -6);
    this._scene.add(rim);
  }

  _setupGround() {
    const texture = CanvasTextureFactory.scanlineGrid(256, 'rgba(80,220,255,0.35)', '#050510');
    texture.repeat.set(8, 8);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this._disposer.trackTexture(texture);

    const geometry = new THREE.PlaneGeometry(60, 40);
    geometry.rotateX(-Math.PI / 2);
    this._disposer.trackGeometry(geometry);

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0x222244,
      roughness: 0.9,
      metalness: 0.1
    });
    this._disposer.trackMaterial(material);

    const ground = new THREE.Mesh(geometry, material);
    ground.position.set(0, -0.5, -3);
    this._scene.add(ground);
  }

  _resetBunkers() {
    for (const bunker of this._bunkers) bunker.dispose();
    this._bunkers.length = 0;

    const spacing = (PLAYFIELD.maxX - PLAYFIELD.minX) / (BUNKER.count + 1);
    for (let i = 0; i < BUNKER.count; i++) {
      const x = PLAYFIELD.minX + spacing * (i + 1);
      this._bunkers.push(new Bunker(this._scene, x, BUNKER.z, this._disposer));
    }
  }

  _buildStateMachine() {
    const states = {
      menu: {
        enter: () => {
          this._hud.showStartScreen(() => {
            this._audioDirector.unlock();
            this._audioDirector.uiSelect();
            this._startNewGame();
          });
        },
        update: () => {}
      },
      playing: {
        enter: () => this._hud.hideOverlay(),
        update: (dt) => this._updatePlaying(dt)
      },
      paused: {
        enter: () => {
          this._hud.showPauseScreen(() => {
            this._audioDirector.uiSelect();
            this._stateMachine.transition('playing');
          });
        },
        update: () => {}
      },
      waveClear: {
        enter: () => {
          this._audioDirector.waveClear();
          this._hud.showWaveClearScreen(this._spawnSystem.waveNumber, () => {
            this._audioDirector.uiSelect();
            this._spawnSystem.startWave(this._spawnSystem.waveNumber + 1);
            this._stateMachine.transition('playing');
          });
        },
        update: () => {}
      },
      gameOver: {
        enter: () => {
          this._hud.showGameOverScreen(this._scoring.score, () => {
            this._audioDirector.uiSelect();
            this._startNewGame();
          });
        },
        update: () => {}
      }
    };

    this._stateMachine = new StateMachine(states, 'menu');
  }

  _startNewGame() {
    this._scoring.reset();
    this._player.reset();
    this._audioDirector.reset();
    this._formationReachedPlayer = false;
    this._resetBunkers();
    this._spawnSystem.startWave(1);
    this._stateMachine.transition('playing');
  }

  start() {
    this._engine.start(
      (dt) => this._stateMachine.update(dt),
      () => this._postfx.render()
    );
  }

  _updatePlaying(rawDt) {
    const dt = this._hitStop.update(rawDt);
    this._cameraShake.update(dt);

    this._input.poll();
    if (InputBindings.wasPausePressed(this._input)) {
      this._stateMachine.transition('paused');
      return;
    }

    this._player.update(dt, InputBindings.getMoveAxis(this._input));
    this._updatePlayerFiring(dt);

    this._formationMovement.update(dt, this._spawnSystem.waveConfig, () => {
      this._formationReachedPlayer = true;
    });

    const aliveRatio = this._formation.totalCount > 0 ? this._formation.aliveCount / this._formation.totalCount : 1;
    const tension = 1 - aliveRatio;
    this._postfx.setBloomStrength(lerp(0.55, 1.0, tension));
    this._formation.setEmissiveIntensity(lerp(1.0, 1.8, tension));

    this._spawnSystem.update(dt, {
      onEnemyFire: () => this._audioDirector.enemyShoot()
    });

    this._projectiles.update(dt, PROJECTILE_BOUNDS);

    for (const bunker of this._bunkers) bunker.update(dt);

    this._collision.resolve({
      onEnemyKilled: (cell, bullet) => this._onEnemyKilled(cell, bullet),
      onPlayerHit: (player, bullet) => this._onPlayerHit(player, bullet),
      onBunkerHit: (bunker, x, y, z, owner) => this._onBunkerHit(bunker, x, y, z, owner),
      onBossHit: (boss, bullet) => this._onBossHit(boss, bullet)
    });

    this._particles.update(dt);
    this._motionTrail.update();
    this._shockwave.update(dt);
    this._floatingText.update(dt);
    this._starfield.update(dt);

    this._audioDirector.update(dt, this._formation.stepInterval);
    this._scoring.update(dt);

    this._hud.syncScore(this._scoring);
    this._hud.syncLives(this._player);
    this._hud.syncWave(this._spawnSystem);

    this._checkWinLossConditions();
  }

  _updatePlayerFiring(dt) {
    if (InputBindings.wasFirePressed(this._input) && this._player.canFire()) {
      this._player.startCharge();
    }
    if (this._player.isCharging) {
      this._player.updateCharge(dt);
    }
    if (InputBindings.wasFireReleased(this._input) && this._player.isCharging) {
      const chargeTime = this._player.releaseCharge();
      this._firePlayerBullet(chargeTime);
      this._player.fireTimer = PLAYER.fireCooldown;
    }
  }

  _firePlayerBullet(chargeTime) {
    const isCharged = chargeTime >= CHARGE_THRESHOLD;
    const nose = this._player.noseWorldPosition;
    const radius = isCharged ? PLAYER.chargedBulletRadius : PLAYER.bulletRadius;
    const speed = isCharged ? PLAYER.chargedBulletSpeed : PLAYER.bulletSpeed;
    const color = isCharged ? 0xffb02e : 0x4de8ff;

    const bullet = this._projectiles.spawn({
      x: nose.x,
      y: nose.y,
      z: nose.z,
      vx: 0,
      vy: 0,
      vz: -speed,
      owner: PROJECTILE_OWNER.PLAYER,
      radius,
      damage: isCharged ? 3 : 1,
      color,
      rotationX: Math.PI / 2
    });

    if (bullet) {
      this._motionTrail.register(bullet.mesh, { color, width: isCharged ? 0.28 : 0.16 });
    }

    this._ufoBoss.registerPlayerShot();
    this._audioDirector.playerShoot();
  }

  _onEnemyKilled(cell, bullet) {
    const points = this._formation.pointsFor(cell.archetype);
    this._scoring.awardKill(points, cell.worldX, cell.worldY, cell.worldZ);

    const deadSoFar = this._formation.totalCount - this._formation.aliveCount;
    this._audioDirector.enemyExplode(1 + deadSoFar * 0.01);
    if (this._scoring.combo > 1) this._audioDirector.comboTick(this._scoring.combo);

    const color = cell.archetype === 'titan' ? 0xffb02e : cell.archetype === 'warden' ? 0xff3fd6 : 0x4de8ff;
    this._particles.burst({
      x: cell.worldX,
      y: cell.worldY,
      z: cell.worldZ,
      count: 16,
      speed: 5,
      speedVariance: 2.5,
      life: 0.5,
      size: 0.14,
      color,
      gravity: -4
    });
    this._shockwave.spawn({ x: cell.worldX, y: 0.1, z: cell.worldZ, color, maxRadius: 1.8, duration: 0.5 });
    this._cameraShake.addTrauma(0.18);
  }

  _onPlayerHit(player, bullet) {
    this._scoring.breakCombo();
    this._particles.burst({
      x: player.position.x,
      y: 0.3,
      z: player.position.z,
      count: 28,
      speed: 6,
      speedVariance: 3,
      life: 0.6,
      size: 0.16,
      color: 0xff5050,
      gravity: -3
    });
    this._shockwave.spawn({ x: player.position.x, y: 0.1, z: player.position.z, color: 0xff5050, maxRadius: 2.5, duration: 0.6 });
    this._cameraShake.addTrauma(0.7);
    this._hitStop.trigger(0.08, 0.05);
    this._input.rumble(0.8, 200);

    if (player.lives <= 0) {
      this._audioDirector.playerExplode();
      player.kill();
    }
  }

  _onBunkerHit(bunker, x, y, z, owner) {
    this._audioDirector.bunkerHit();
    this._particles.burst({
      x,
      y,
      z,
      count: 8,
      speed: 3,
      speedVariance: 1.5,
      life: 0.3,
      size: 0.08,
      color: 0x8bff4d,
      gravity: -6
    });
    this._cameraShake.addTrauma(0.06);
  }

  _onBossHit(boss, bullet) {
    const dead = boss.takeDamage(bullet.damage);
    this._particles.burst({
      x: boss.mesh.position.x,
      y: boss.mesh.position.y,
      z: boss.mesh.position.z,
      count: 10,
      speed: 4,
      speedVariance: 2,
      life: 0.4,
      size: 0.12,
      color: 0x9b5bff
    });

    if (!dead) {
      this._cameraShake.addTrauma(0.15);
      return;
    }

    const wasBoss = boss.isBoss;
    const bonus = wasBoss ? 500 : boss.consumeBonusScore();
    this._scoring.awardBonus(
      bonus,
      boss.mesh.position.x,
      boss.mesh.position.y,
      boss.mesh.position.z,
      wasBoss ? 'FLAGSHIP' : 'UFO'
    );

    this._particles.burst({
      x: boss.mesh.position.x,
      y: boss.mesh.position.y,
      z: boss.mesh.position.z,
      count: 40,
      speed: 7,
      speedVariance: 3,
      life: 0.7,
      size: 0.18,
      color: 0x9b5bff,
      gravity: -2
    });
    this._shockwave.spawn({
      x: boss.mesh.position.x,
      y: boss.mesh.position.y,
      z: boss.mesh.position.z,
      color: 0x9b5bff,
      maxRadius: wasBoss ? 5 : 2.5,
      duration: 0.8
    });
    this._cameraShake.addTrauma(wasBoss ? 1 : 0.4);
    this._hitStop.trigger(wasBoss ? 0.12 : 0.05, 0.05);
    boss.destroy();
  }

  _checkWinLossConditions() {
    if (this._formationReachedPlayer) {
      this._formationReachedPlayer = false;
      this._player.lives = 0;
      this._player.kill();
      this._triggerGameOver();
      return;
    }

    if (!this._player.alive) {
      this._triggerGameOver();
      return;
    }

    if (this._formation.aliveCount === 0) {
      this._stateMachine.transition('waveClear');
    }
  }

  _triggerGameOver() {
    if (this._stateMachine.currentName !== 'gameOver') {
      this._stateMachine.transition('gameOver');
    }
  }

  dispose() {
    this._engine.stop();
    this._input.dispose();
    this._hud.dispose();
    this._floatingText.dispose();
    this._shockwave.dispose();
    this._motionTrail.dispose();
    this._particles.dispose(this._scene);
    this._projectiles.dispose();
    this._formation.dispose();
    for (const bunker of this._bunkers) bunker.dispose();
    this._ufoBoss.dispose();
    this._starfield.dispose(this._scene);
    this._postfx.dispose();
    this._disposer.disposeAll();
    this._engine.dispose();
  }
}
