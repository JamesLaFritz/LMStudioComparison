import * as THREE from 'three';
import { Player } from './simulation/Player.js';
import { EnemyGrid } from './simulation/EnemyGrid.js';
import { Bullet } from './simulation/Bullet.js';
import { Shield } from './simulation/Shield.js';
import { UFO } from './simulation/UFO.js';
import { GameState } from './simulation/GameState.js';
import { Renderer } from './render/Renderer.js';
import { Starfield } from './render/Starfield.js';
import { GridFloor } from './render/GridFloor.js';
import { PostProcessing } from './render/PostProcessing.js';
import { EnemyMeshFactory } from './render/EnemyMeshFactory.js';
import { PlayerMesh } from './render/PlayerMesh.js';
import { ProjectileRenderer } from './render/ProjectileRenderer.js';
import { ShieldRenderer } from './render/ShieldRenderer.js';
import { UFOVisuals } from './render/UFOVisuals.js';
import * as C from './utils/Constants.js';

export class Game {
  constructor(container, inputController, audioSynth) {
    this.container = container;
    this.input = inputController;
    this.audio = audioSynth;

    // Simulation state
    this.player = new Player();
    this.enemyGrid = new EnemyGrid();
    this.shield = new Shield();
    this.ufo = new UFO();
    this.gameState = new GameState();

    // Rendering
    this.renderer = new Renderer(container);
    this.starfield = new Starfield(this.renderer.scene, this.renderer.camera);
    this.gridFloor = new GridFloor(this.renderer.scene);
    this.postProcessing = new PostProcessing(this.renderer.renderer, container);
    this.enemyMeshFactory = new EnemyMeshFactory();
    this.playerMesh = new PlayerMesh(this.renderer.scene);
    this.projectileRenderer = new ProjectileRenderer(this.renderer.scene);
    this.shieldRenderer = new ShieldRenderer(this.renderer.scene);
    this.ufoVisuals = new UFOVisuals(this.renderer.scene);

    // VFX systems (injected from shared)
    this.cameraShake = null;
    this.hitStop = null;
    this.particleManager = null;
    this.shockwaveRingPool = null;
    this.floatingText = null;

    // Projectiles
    this.playerBullets = [];
    this.enemyBullets = [];

    // Mesh references for sync
    this.enemyMeshes = [];

    // Timers
    this.lastEnemyFireTime = 0;
    this.waveTransitionTimer = 0;
    this.isWaveTransitioning = false;

    // Motion trails
    this.playerBulletTrails = [];
    this.enemyBulletTrails = [];

    // DOM flash for hit-stop
    this.flashOverlay = null;

    this.init();
  }

  init() {
    // Setup enemy meshes from grid data
    const gridData = this.enemyGrid.getGridData();
    this.enemyMeshes = this.enemyMeshFactory.createAll(gridData, this.renderer.scene);

    // Setup shield renderer with shield simulation data
    this.shieldRenderer.init(this.shield.getCellCount());

    // Setup UFO visuals
    this.ufoVisuals.init();

    // Position player mesh
    this.playerMesh.setPosition(0, C.PLAYER_Z, 0);

    // Setup starfield and grid floor
    this.starfield.updateCamera(this.renderer.camera);
    this.gridFloor.updateCamera(this.renderer.camera);

    // Initialize post-processing with scene and camera
    this.postProcessing.init(this.renderer.scene, this.renderer.camera);

    // Start enemy formation
    this.enemyGrid.start();

    // Bind VFX systems (called from main.js after shared modules load)
    this.onVfxReady = null;
  }

  setVfxSystems(cameraShake, hitStop, particleManager, shockwaveRingPool, floatingText) {
    this.cameraShake = cameraShake;
    this.hitStop = hitStop;
    this.particleManager = particleManager;
    this.shockwaveRingPool = shockwaveRingPool;
    this.floatingText = floatingText;

    // Create flash overlay for hit-stop
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: white; opacity: 0; pointer-events: none; z-index: 9999;
    `;
    document.body.appendChild(this.flashOverlay);

    if (this.onVfxReady) this.onVfxReady();
  }

  triggerCameraShake(intensity, decayRate, duration) {
    if (this.cameraShake) {
      this.cameraShake.shake(intensity, decayRate, duration);
    }
  }

  triggerHitStop(durationFrames, timescale) {
    if (this.hitStop) {
      this.hitStop.start(durationFrames, timescale);
    }
  }

  spawnParticleBurst(position, color, count, speedRange, lifetime) {
    if (this.particleManager) {
      const [minSpeed, maxSpeed] = speedRange;
      for (let i = 0; i < count; i++) {
        this.particleManager.spawn(
          position.x, position.y, position.z,
          (Math.random() - 0.5) * (maxSpeed - minSpeed) + minSpeed,
          (Math.random() - 0.5) * (maxSpeed - minSpeed) + minSpeed,
          (Math.random() - 0.5) * (maxSpeed - minSpeed) + minSpeed,
          color, lifetime
        );
      }
    }
  }

  spawnShockwave(position, color) {
    if (this.shockwaveRingPool && this.shockwaveRingPool.acquire) {
      const ring = this.shockwaveRingPool.acquire();
      if (ring) {
        ring.init(position.x, position.y, position.z, color);
      }
    }
  }

  spawnFloatingText(position3D, scoreValue, color) {
    if (this.floatingText) {
      this.floatingText.show(position3D, scoreValue, color);
    }
  }

  flashScreen(durationMs) {
    if (this.flashOverlay) {
      this.flashOverlay.style.opacity = '0.8';
      setTimeout(() => {
        this.flashOverlay.style.opacity = '0';
      }, durationMs);
    }
  }

  update(deltaTime, timescale) {
    const effectiveDt = deltaTime * timescale;

    // Wave transition handling
    if (this.isWaveTransitioning) {
      this.waveTransitionTimer -= effectiveDt;
      if (this.waveTransitionTimer <= 0) {
        this.isWaveTransitioning = false;
        this.enemyGrid.start();
      }
      return;
    }

    // Update player
    const inputDir = this.input.getAxis('horizontal');
    this.player.update(inputDir, effectiveDt);

    // Sync player mesh
    this.playerMesh.setPosition(
      this.player.position.x,
      this.player.position.y,
      this.player.position.z
    );
    this.playerMesh.setBlinking(this.player.isRespawning());

    // Player shooting
    if (this.input.justPressed('fire') && this.player.canShoot()) {
      this.firePlayerBullet();
    }

    // Update player bullets
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const bullet = this.playerBullets[i];
      if (!bullet.active) continue;

      bullet.position.y += C.PLAYER_BULLET_SPEED * effectiveDt;

      // Update motion trail
      this.updateMotionTrail(bullet, this.playerBulletTrails);

      // Check bounds
      if (bullet.position.y > C.FIELD_TOP) {
        bullet.deactivate();
        this.playerBullets.splice(i, 1);
        continue;
      }

      // Check collision with enemies
      let hitEnemy = false;
      for (const enemy of this.enemyGrid.getEnemies()) {
        if (!enemy.alive) continue;
        const worldPos = enemy.getWorldPosition();
        if (this.checkAABB(
          bullet.position.x - 0.05, bullet.position.y - 0.1, bullet.position.z,
          bullet.position.x + 0.05, bullet.position.y + 0.1, bullet.position.z,
          worldPos.x - C.ENEMY_SIZE_X / 2, worldPos.y - C.ENEMY_SIZE_Y / 2, worldPos.z - C.ENEMY_SIZE_Z / 2,
          worldPos.x + C.ENEMY_SIZE_X / 2, worldPos.y + C.ENEMY_SIZE_Y / 2, worldPos.z + C.ENEMY_SIZE_Z / 2
        )) {
          this.killEnemy(enemy);
          bullet.deactivate();
          hitEnemy = true;
          break;
        }
      }

      if (hitEnemy) continue;

      // Check collision with UFO
      if (this.ufo.isActive()) {
        const ufoPos = this.ufo.getPosition();
        if (this.checkAABB(
          bullet.position.x - 0.05, bullet.position.y - 0.1, bullet.position.z,
          bullet.position.x + 0.05, bullet.position.y + 0.1, bullet.position.z,
          ufoPos.x - C.UFO_SIZE_X / 2, ufoPos.y - C.UFO_SIZE_Y / 2, ufoPos.z - C.UFO_SIZE_Z / 2,
          ufoPos.x + C.UFO_SIZE_X / 2, ufoPos.y + C.UFO_SIZE_Y / 2, ufoPos.z + C.UFO_SIZE_Z / 2
        )) {
          this.killUFO();
          bullet.deactivate();
          continue;
        }
      }

      // Check collision with shields
      if (this.shield.checkAndDamageBullet(bullet.position.x, bullet.position.y)) {
        bullet.deactivate();
        this.audio.playShieldHit();
        continue;
      }
    }

    // Update enemy grid
    const formationPos = this.enemyGrid.getFormationPosition();
    const formationSpeed = this.enemyGrid.getSpeed();

    for (const mesh of this.enemyMeshes) {
      mesh.update(formationPos, effectiveDt);
    }

    // Enemy shooting
    this.lastEnemyFireTime += effectiveDt;
    if (this.lastEnemyFireTime > C.ENEMY_FIRE_INTERVAL) {
      this.lastEnemyFireTime = 0;
      const bottomEnemies = this.enemyGrid.getBottomEnemies();
      for (const enemy of bottomEnemies) {
        if (!enemy.alive) continue;
        if (Math.random() < C.ENEMY_FIRE_CHANCE * (1 + this.gameState.getKillCount() * 0.05)) {
          const worldPos = enemy.getWorldPosition();
          this.fireEnemyBullet(worldPos.x, worldPos.y - C.ENEMY_SIZE_Y / 2);
        }
      }
    }

    // Update enemy bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = this.enemyBullets[i];
      if (!bullet.active) continue;

      bullet.position.y -= C.ENEMY_BULLET_SPEED * effectiveDt;

      // Update motion trail
      this.updateMotionTrail(bullet, this.enemyBulletTrails);

      // Check bounds
      if (bullet.position.y < C.FIELD_BOTTOM) {
        bullet.deactivate();
        this.enemyBullets.splice(i, 1);
        continue;
      }

      // Check collision with player
      if (!this.player.isInvulnerable() && this.checkAABB(
        bullet.position.x - 0.05, bullet.position.y - 0.1, bullet.position.z,
        bullet.position.x + 0.05, bullet.position.y + 0.1, bullet.position.z,
        this.player.position.x - C.PLAYER_SIZE_X / 2, this.player.position.y - C.PLAYER_SIZE_Y / 2, this.player.position.z - C.PLAYER_SIZE_Z / 2,
        this.player.position.x + C.PLAYER_SIZE_X / 2, this.player.position.y + C.PLAYER_SIZE_Y / 2, this.player.position.z + C.PLAYER_SIZE_Z / 2
      )) {
        this.killPlayer();
        bullet.deactivate();
        this.enemyBullets.splice(i, 1);
        continue;
      }

      // Check collision with shields
      if (this.shield.checkAndDamageBullet(bullet.position.x, bullet.position.y)) {
        bullet.deactivate();
        this.audio.playShieldHit();
        continue;
      }
    }

    // Update shields
    this.shield.update(effectiveDt);

    // Sync shield renderer
    this.shieldRenderer.update(this.shield.getCells());

    // Update UFO
    const ufoState = this.ufo.update(effectiveDt, formationPos.x);
    if (ufoState.active) {
      this.ufoVisuals.setPosition(ufoState.position.x, ufoState.position.y, ufoState.position.z);
      this.ufoVisuals.setPulse(Math.sin(Date.now() * 0.01) * 0.5 + 0.5);
    }

    // Sync enemy meshes positions from grid
    const enemies = this.enemyGrid.getEnemies();
    for (let i = 0; i < this.enemyMeshes.length && i < enemies.length; i++) {
      if (enemies[i].alive) {
        const wp = enemies[i].getWorldPosition();
        this.enemyMeshes[i].setPosition(wp.x, wp.y, wp.z);
        this.enemyMeshes[i].setPose(enemies[i].poseFrame);
      }
    }

    // Sync projectiles to renderer
    this.projectileRenderer.updatePlayerBullets(this.playerBullets.filter(b => b.active));
    this.projectileRenderer.updateEnemyBullets(this.enemyBullets.filter(b => b.active));

    // Update motion trails
    this.updateAllTrails();

    // Check wave completion
    if (this.enemyGrid.isComplete() && !this.isWaveTransitioning) {
      this.startWaveTransition();
    }

    // Update starfield parallax
    this.starfield.updateCamera(this.renderer.camera);

    // Update grid floor pulse based on formation speed
    this.gridFloor.setPulse(0.7 + 0.3 * Math.sin(Date.now() * 0.001 * formationSpeed * 2));

    // Update post-processing
    this.postProcessing.update(effectiveDt);
  }

  updateMotionTrail(bullet, trails) {
    if (!bullet.active) return;
    const trail = { x: bullet.position.x, y: bullet.position.y };
    trails.unshift(trail);
    while (trails.length > C.MOTION_TRAIL_LENGTH) {
      trails.pop();
    }
  }

  updateAllTrails() {
    // Player bullet trails
    for (const trail of this.playerBulletTrails) {
      if (trail.line) {
        const positions = trail.line.geometry.attributes.position.array;
        let idx = 0;
        for (let i = 0; i < C.MOTION_TRAIL_LENGTH && i < trail.positions.length; i++) {
          positions[idx++] = trail.positions[i].x;
          positions[idx++] = trail.positions[i].y;
          positions[idx++] = trail.positions[i].z || C.PLAYER_Z;
        }
        for (let i = trail.positions.length; i < C.MOTION_TRAIL_LENGTH; i++) {
          const last = trail.positions[trail.positions.length - 1];
          positions[idx++] = last.x;
          positions[idx++] = last.y;
          positions[idx++] = last.z || C.PLAYER_Z;
        }
        trail.line.geometry.attributes.position.needsUpdate = true;
      }
    }

    // Enemy bullet trails
    for (const trail of this.enemyBulletTrails) {
      if (trail.line) {
        const positions = trail.line.geometry.attributes.position.array;
        let idx = 0;
        for (let i = 0; i < C.MOTION_TRAIL_LENGTH && i < trail.positions.length; i++) {
          positions[idx++] = trail.positions[i].x;
          positions[idx++] = trail.positions[i].y;
          positions[idx++] = trail.positions[i].z || 0;
        }
        for (let i = trail.positions.length; i < C.MOTION_TRAIL_LENGTH; i++) {
          const last = trail.positions[trail.positions.length - 1];
          positions[idx++] = last.x;
          positions[idx++] = last.y;
          positions[idx++] = last.z || 0;
        }
        trail.line.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  firePlayerBullet() {
    if (!this.player.canShoot()) return;
    this.player.shoot();
    const bullet = new Bullet(
      this.player.position.x,
      this.player.position.y + C.PLAYER_SIZE_Y / 2,
      C.PLAYER_Z
    );
    this.playerBullets.push(bullet);

    // Create motion trail for this bullet
    const trail = { positions: [], line: null };
    this.playerBulletTrails.push(trail);

    this.audio.playPlayerShoot();
  }

  fireEnemyBullet(x, y) {
    const bullet = new Bullet(x, y, C.ENEMY_BULLET_Z);
    this.enemyBullets.push(bullet);

    // Create motion trail for this bullet
    const trail = { positions: [], line: null };
    this.enemyBulletTrails.push(trail);
  }

  killEnemy(enemy) {
    enemy.die();
    const worldPos = enemy.getWorldPosition();
    const color = C.ENEMY_COLORS[enemy.type];
    const points = C.ENEMY_POINTS[enemy.type];

    this.gameState.addScore(points);
    this.gameState.incrementKills();

    // VFX: particle burst
    this.spawnParticleBurst(
      { x: worldPos.x, y: worldPos.y, z: worldPos.z },
      color, 15, [2, 6], 0.8
    );

    // VFX: shockwave ring
    this.spawnShockwave({ x: worldPos.x, y: worldPos.y, z: worldPos.z }, color);

    // VFX: floating text
    this.spawnFloatingText(
      { x: worldPos.x, y: worldPos.y, z: worldPos.z },
      points, color
    );

    // VFX: camera shake (light)
    this.triggerCameraShake(0.3, 0.92, 0.4);

    // Audio
    this.audio.playEnemyDeath(enemy.type);

    // Update enemy mesh visibility
    const idx = this.enemyGrid.getEnemyIndex(enemy);
    if (idx >= 0 && idx < this.enemyMeshes.length) {
      this.enemyMeshes[idx].setVisible(false);
    }
  }

  killPlayer() {
    if (!this.player.isRespawning()) return;

    const pos = this.player.position.clone();
    const color = C.PLAYER_COLOR;

    // VFX: big particle burst
    this.spawnParticleBurst(pos, color, 40, [3, 10], 1.2);

    // VFX: hit-stop (12 frame freeze)
    this.triggerHitStop(12, 0.0);

    // VFX: screen flash
    this.flashScreen(50);

    // VFX: camera shake (heavy)
    this.triggerCameraShake(0.8, 0.95, 1.0);

    // Audio
    this.audio.playPlayerDeath();

    // Lose life
    if (!this.player.takeDamage()) {
      // No lives left - game over
      this.gameState.setGameOver(true);
      this.audio.stopAmbientDrone();
    } else {
      // Respawn with invulnerability
      this.player.respawn();
    }
  }

  killUFO() {
    const pos = this.ufo.getPosition();
    const color = C.UFO_COLOR;
    const points = this.ufo.getPoints();

    this.gameState.addScore(points);
    this.gameState.incrementKills();

    // VFX: particle burst
    this.spawnParticleBurst(pos, color, 25, [4, 8], 1.0);

    // VFX: shockwave ring
    this.spawnShockwave(pos, color);

    // VFX: floating text
    this.spawnFloatingText(pos, points, color);

    // VFX: camera shake (medium)
    this.triggerCameraShake(0.6, 0.93, 0.7);

    // Audio
    this.audio.playUfoDeath();

    // Hide UFO mesh
    this.ufoVisuals.setVisible(false);
    this.ufo.deactivate();
  }

  startWaveTransition() {
    const wave = this.gameState.getWave();
    this.isWaveTransitioning = true;
    this.waveTransitionTimer = C.WAVE_TRANSITION_DURATION;

    // FOV zoom effect
    this.renderer.camera.fov = 60;
    this.renderer.camera.updateProjectionMatrix();

    // Animate FOV out and back via post-processing update hook
    const startTime = Date.now();
    const duration = 1500;
    const animateFov = () => {
      if (!this.isWaveTransitioning) return;
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Zoom out then back in
      let fov;
      if (t < 0.5) {
        fov = 60 + 15 * (t * 2); // 60 -> 75
      } else {
        fov = 75 - 15 * ((t - 0.5) * 2); // 75 -> 60
      }
      this.renderer.camera.fov = fov;
      this.renderer.camera.updateProjectionMatrix();

      if (t < 1) requestAnimationFrame(animateFov);
    };
    animateFov();

    // Show wave text via floating text system or custom overlay
    if (this.floatingText) {
      const centerPos = new THREE.Vector3(0, 0, C.ENEMY_BULLET_Z);
      this.spawnFloatingText(centerPos, `WAVE ${wave}`, '#ffffff');
    }

    // Audio cue
    this.audio.playWaveTransition();
  }

  checkAABB(x1, y1, z1, x2, y2, z2, ex1, ey1, ez1, ex2, ey2, ez2) {
    return (x1 <= ex2 && x2 >= ex1 &&
            y1 <= ey2 && y2 >= ey1 &&
            z1 <= ez2 && z2 >= ez1);
  }

  start() {
    // Start the animation loop
    this._lastTime = performance.now();
    this._loop = () => {
      const now = performance.now();
      const dt = Math.min((now - this._lastTime) / 1000, 0.1); // cap at 100ms
      this._lastTime = now;

      if (!this.gameState.gameOver) {
        this.update(dt, 1.0);
      }
      this.render();
      requestAnimationFrame(this._loop.bind(this));
    };
    requestAnimationFrame(this._loop.bind(this));
  }

  render() {
    this.postProcessing.render();
  }

  dispose() {
    // Dispose all Three.js objects to prevent memory leaks
    this.playerMesh.dispose();
    this.enemyMeshFactory.dispose();
    this.projectileRenderer.dispose();
    this.shieldRenderer.dispose();
    this.ufoVisuals.dispose();
    this.starfield.dispose();
    this.gridFloor.dispose();
    this.postProcessing.dispose();

    // Dispose simulation objects
    for (const bullet of this.playerBullets) {
      if (bullet.geometry) bullet.geometry.dispose();
      if (bullet.material) bullet.material.dispose();
    }
    for (const bullet of this.enemyBullets) {
      if (bullet.geometry) bullet.geometry.dispose();
      if (bullet.material) bullet.material.dispose();
    }

    // Dispose motion trails
    for (const trail of [...this.playerBulletTrails, ...this.enemyBulletTrails]) {
      if (trail.line) {
        trail.line.geometry.dispose();
        if (trail.line.material) trail.line.material.dispose();
      }
    }

    this.renderer.dispose();
  }
}
