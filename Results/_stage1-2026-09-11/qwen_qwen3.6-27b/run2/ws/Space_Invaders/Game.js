import * as THREE from 'three';
import { Player } from './Player.js';
import { InvaderGrid } from './InvaderGrid.js';
import { Shields } from './Shields.js';
import { ProjectileSystem } from './ProjectileSystem.js';
import { MysteryShip } from './MysteryShip.js';
import { WaveManager } from './WaveManager.js';
import { ScoreSystem } from './ScoreSystem.js';
import { CollisionSystem } from './CollisionSystem.js';
import { Background } from './Background.js';
import { HUD } from './HUD.js';
import { MemoryTracker } from 'shared/memory/MemoryTracker.js';
import { CONFIG } from './config.js';

export class Game {
  constructor(scene, camera, composer, input, vfx, audio) {
    this.scene = scene;
    this.camera = camera;
    this.composer = composer;
    this.input = input;
    this.vfx = vfx;
    this.audio = audio;

    this.tracker = new MemoryTracker();
    this.state = 'menu';
    this.waveClearTimer = 0;
    this.gameOverTimer = 0;

    // Subsystems
    this.player = null;
    this.invaderGrid = null;
    this.shields = null;
    this.projectiles = null;
    this.mysteryShip = null;
    this.waveManager = null;
    this.scoreSystem = null;
    this.collisions = null;
    this.background = null;
    this.hud = null;

    // Lighting
    this.orbitLight1 = null;
    this.orbitLight2 = null;
    this.playerLight = null;
    this.flashLight = null;
    this.orbitAngle = 0;

    // Screen flash
    this.flashOverlay = null;
    this.flashAlpha = 0;

    // Thruster timer
    this.thrusterTimer = 0;
  }

  init() {
    // Clear scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    this.tracker.disposeAll();

    // Ambient light
    const ambient = new THREE.AmbientLight(0x334455, 0.4);
    this.scene.add(ambient);

    // Orbiting lights
    this.orbitLight1 = new THREE.PointLight(0x00ffff, 2, 30);
    this.orbitLight1.position.set(5, 5, 5);
    this.scene.add(this.orbitLight1);

    this.orbitLight2 = new THREE.PointLight(0xff00ff, 2, 30);
    this.orbitLight2.position.set(-5, -5, 5);
    this.scene.add(this.orbitLight2);

    // Player attached light
    this.playerLight = new THREE.PointLight(0x0088ff, 1.5, 8);
    this.scene.add(this.playerLight);

    // Flash light for explosions
    this.flashLight = new THREE.PointLight(0xffffff, 0, 20);
    this.scene.add(this.flashLight);

    // Screen flash overlay
    this.flashOverlay = document.getElementById('screen-flash');
    this.flashAlpha = 0;

    // Background
    this.background = new Background(this.scene, this.tracker);
    this.background.init();

    // Player
    this.player = new Player(this.scene, this.tracker);
    this.player.init();

    // Invader grid
    this.invaderGrid = new InvaderGrid(this.scene, this.tracker);
    this.invaderGrid.init(1);

    // Shields
    this.shields = new Shields(this.scene, this.tracker);
    this.shields.init();

    // Projectiles
    this.projectiles = new ProjectileSystem(this.scene, this.tracker);
    this.projectiles.init();

    // Mystery ship
    this.mysteryShip = new MysteryShip(this.scene, this.tracker);
    this.mysteryShip.init();

    // Wave manager
    this.waveManager = new WaveManager();

    // Score system
    this.scoreSystem = new ScoreSystem();

    // Collision system
    this.collisions = new CollisionSystem();

    // HUD
    this.hud = new HUD();
    this.hud.init();

    // Start music
    this.audio.startMusic();

    this.state = 'playing';
  }

  startWave(waveNum) {
    this.invaderGrid.reset(waveNum);
    this.shields.reset();
    this.projectiles.clear();
    this.mysteryShip.despawn();
    this.waveManager.advanceWave();
    this.scoreSystem.onWaveClear();
    this.audio.setWave(waveNum);
  }

  update(dt) {
    if (this.state === 'menu') {
      if (this.input.wasJustPressed('fire')) {
        this.init();
      }
      return;
    }

    if (this.state === 'gameOver') {
      this.gameOverTimer += dt;
      this.vfx.particles.update(dt);
      this.vfx.shockwaves.update(dt);
      this.vfx.floatingText.update(dt);
      this.background.update(dt);
      this.updateOrbitLights(dt);
      if (this.input.wasJustPressed('fire') && this.gameOverTimer > 2) {
        this.gameOverTimer = 0;
        this.init();
      }
      return;
    }

    if (this.state === 'waveClear') {
      this.waveClearTimer += dt;
      this.vfx.particles.update(dt);
      this.vfx.shockwaves.update(dt);
      this.vfx.floatingText.update(dt);
      this.background.update(dt);
      this.updateOrbitLights(dt);
      if (this.waveClearTimer > 3) {
        this.state = 'playing';
        this.startWave(this.waveManager.getWave() + 1);
      }
      return;
    }

    // Hit-stop check
    const timescale = this.vfx.hitStop.getTimescale();
    const gameDt = dt * timescale;

    // Update orbiting lights
    this.updateOrbitLights(dt);

    // Player light follows ship
    this.playerLight.position.copy(this.player.group.position);
    this.playerLight.position.z += 2;

    // Player update
    this.player.update(gameDt, this.input);

    // Player firing
    const firePos = this.player.fire();
    if (firePos) {
      this.projectiles.firePlayer(firePos);
      this.audio.playSFX('playerShoot');
    }

    // Thruster particles
    this.thrusterTimer += dt;
    if (this.thrusterTimer > 0.05) {
      this.thrusterTimer = 0;
      const count = Math.abs(this.input.getAxis('horizontal')) > 0.1 ? 3 : 1;
      this.vfx.particles.burst(
        this.player.group.position.clone(),
        count,
        0x0088ff,
        0.3,
        1.5
      );
    }

    // Invader grid update
    this.invaderGrid.update(gameDt);

    // Invader firing
    const invaderFirePos = this.invaderGrid.fire(gameDt);
    if (invaderFirePos) {
      this.projectiles.fireInvader(invaderFirePos);
      this.audio.playSFX('invaderShoot');
    }

    // Projectile update
    this.projectiles.update(gameDt);

    // Mystery ship update
    this.mysteryShip.update(gameDt);

    // Collision detection
    this.resolveCollisions();

    // Check wave clear
    if (this.invaderGrid.getAlive().length === 0 && this.state === 'playing') {
      this.onWaveClear();
    }

    // Check invader descent
    if (this.invaderGrid.checkDescent() && this.state === 'playing') {
      this.onGameOver();
    }

    // Update HUD
    this.hud.update(
      this.scoreSystem.getScore(),
      this.waveManager.getWave(),
      this.player.hp,
      CONFIG.PLAYER_MAX_HP,
      this.scoreSystem.getCombo(),
      this.scoreSystem.getMultiplier()
    );

    // Update VFX
    this.vfx.particles.update(dt);
    this.vfx.shake.update(dt, this.camera);
    this.vfx.trails.update(dt);
    this.vfx.shockwaves.update(dt);
    this.vfx.floatingText.update(dt);
    this.background.update(dt);

    // Screen flash decay
    if (this.flashAlpha > 0) {
      this.flashAlpha -= dt * 3;
      if (this.flashAlpha < 0) this.flashAlpha = 0;
      if (this.flashOverlay) {
        this.flashOverlay.style.opacity = this.flashAlpha;
      }
    }
  }

  updateOrbitLights(dt) {
    this.orbitAngle += dt * 0.3;
    const r = 10;
    this.orbitLight1.position.x = Math.cos(this.orbitAngle) * r;
    this.orbitLight1.position.y = Math.sin(this.orbitAngle * 0.7) * r * 0.5;
    this.orbitLight2.position.x = Math.cos(this.orbitAngle + Math.PI) * r;
    this.orbitLight2.position.y = Math.sin(this.orbitAngle * 0.7 + Math.PI) * r * 0.5;
  }

  resolveCollisions() {
    const playerProjPos = this.projectiles.getPlayerProjPos();
    const invaderProjPositions = this.projectiles.getInvaderProjPositions();
    const aliveInvaders = this.invaderGrid.getAlive();
    const invaderBounds = aliveInvaders.map(inv => inv.getBounds());

    // Shield erosion callback
    const shieldErode = (pos, radius) => {
      this.shields.erode(pos, radius);
    };

    // Player projectile vs invaders
    if (playerProjPos) {
      const hit = this.collisions.checkPlayerProjectile(
        playerProjPos,
        invaderBounds,
        aliveInvaders,
        shieldErode
      );
      if (hit) {
        this.onInvaderKilled(hit.invader, hit.index);
        this.projectiles.removePlayerProjectile();
      } else {
        // Check vs mystery ship
        if (this.mysteryShip.isAlive) {
          const msHit = this.collisions.checkMysteryShip(playerProjPos, this.mysteryShip.getBounds());
          if (msHit) {
            this.onMysteryShipKilled();
            this.projectiles.removePlayerProjectile();
          }
        }
      }

      // Player projectile vs shields
      this.collisions.checkProjectileVsShields(playerProjPos, shieldErode);
      if (this.collisions.shieldHit) {
        this.projectiles.removePlayerProjectile();
        this.collisions.shieldHit = false;
      }
    }

    // Invader projectiles vs player
    for (let i = invaderProjPositions.length - 1; i >= 0; i--) {
      const projPos = invaderProjPositions[i];
      // vs shields first
      this.collisions.checkProjectileVsShields(projPos, shieldErode);
      if (this.collisions.shieldHit) {
        this.projectiles.removeInvaderProjectile(i);
        this.collisions.shieldHit = false;
        continue;
      }
      // vs player
      if (this.collisions.checkInvaderProjectile(projPos, this.player.getBounds())) {
        this.onPlayerHit();
        this.projectiles.removeInvaderProjectile(i);
      }
    }

    // Player vs invaders (body collision)
    if (this.collisions.checkInvaderDescent(invaderBounds, this.player.getBounds())) {
      this.onPlayerHit();
    }
  }

  onInvaderKilled(invader, index) {
    const basePoints = invader.points;
    const waveMult = this.waveManager.getMultiplier();
    const comboMult = this.scoreSystem.onKill(performance.now());
    const totalPoints = basePoints * waveMult * comboMult;

    this.scoreSystem.add(totalPoints, comboMult);

    // VFX
    const pos = invader.mesh.position.clone();
    const color = invader.emissiveColor;

    // Hit-stop (light)
    this.vfx.hitStop.trigger(60);

    // Camera shake
    this.vfx.shake.addTrauma(0.3);

    // Flash light
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = 5;
    setTimeout(() => { this.flashLight.intensity = 0; }, 100);

    // Particle burst
    this.vfx.particles.burst(pos, 30, color, 1.5, 4);

    // Shockwave ring
    this.vfx.shockwaves.emit(pos, 2.0, color, 0.6);

    // Floating score text
    this.vfx.floatingText.show(pos, `+${totalPoints}`, color, 24, 1.2);

    // Audio
    this.audio.playSFX('invaderKill', 1.0 + (5 - invader.row) * 0.15);

    // Remove invader
    invader.die();
    this.waveManager.onInvaderKilled();
  }

  onPlayerHit() {
    this.player.takeDamage();

    // VFX
    const pos = this.player.group.position.clone();

    // Hit-stop (heavy)
    this.vfx.hitStop.trigger(120);

    // Camera shake
    this.vfx.shake.addTrauma(0.8);

    // Particles
    this.vfx.particles.burst(pos, 20, 0xffffff, 0.8, 3);

    // Audio
    this.audio.playSFX('playerHit');

    // Flash player ship
    this.player.flashHit();

    // Check death
    if (this.player.hp <= 0) {
      this.onGameOver();
    }
  }

  onMysteryShipKilled() {
    const points = this.mysteryShip.points;
    const waveMult = this.waveManager.getMultiplier();
    const totalPoints = points * waveMult;

    this.scoreSystem.add(totalPoints, 1);

    const pos = this.mysteryShip.mesh.position.clone();

    // Hit-stop (dramatic)
    this.vfx.hitStop.trigger(200);

    // Camera shake (heavy)
    this.vfx.shake.addTrauma(1.5);

    // Screen flash
    this.flashAlpha = 0.6;

    // Particles
    this.vfx.particles.burst(pos, 80, 0xff00ff, 3, 6);

    // Shockwave rings (2 staggered)
    this.vfx.shockwaves.emit(pos, 4.0, 0xff00ff, 0.8);
    setTimeout(() => {
      this.vfx.shockwaves.emit(pos, 3.0, 0xffffff, 0.6);
    }, 100);

    // Floating text
    this.vfx.floatingText.show(pos, `+${totalPoints}`, 0xffd700, 36, 2);

    // Audio
    this.audio.playSFX('mysteryKill');

    // Despawn
    this.mysteryShip.despawn();
  }

  onWaveClear() {
    this.state = 'waveClear';
    this.waveClearTimer = 0;

    // VFX
    this.vfx.hitStop.trigger(300);
    this.vfx.shake.addTrauma(0.5);

    // Celebration particles
    for (let i = 0; i < 5; i++) {
      const x = (Math.random() - 0.5) * 10;
      const y = (Math.random() - 0.5) * 6;
      const z = 0;
      const color = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff][i];
      this.vfx.particles.burst(new THREE.Vector3(x, y, z), 20, color, 2, 5);
    }

    // Floating text
    this.vfx.floatingText.show(
      new THREE.Vector3(0, 2, 0),
      `WAVE ${this.waveManager.getWave()} COMPLETE`,
      0xffd700,
      32,
      2.5
    );

    // HUD
    this.hud.showWaveComplete(this.waveManager.getWave());

    // Audio
    this.audio.playSFX('waveClear');
  }

  onGameOver() {
    this.state = 'gameOver';
    this.gameOverTimer = 0;

    // Audio
    this.audio.playSFX('gameOver');
    this.audio.stopMusic();

    // VFX
    this.vfx.hitStop.trigger(400);
    this.vfx.shake.addTrauma(1.2);

    // Big explosion at player position
    this.vfx.particles.burst(
      this.player.group.position.clone(),
      60,
      0xff4444,
      2,
      5
    );

    // HUD
    const stats = {
      score: this.scoreSystem.getScore(),
      wave: this.waveManager.getWave(),
      invadersKilled: this.waveManager.getTotalKilled(),
      accuracy: 0 // simplified
    };
    this.hud.showGameOver(stats);
  }

  dispose() {
    this.tracker.disposeAll();
    if (this.hud) this.hud.dispose();
    this.audio.stopMusic();
  }
}
