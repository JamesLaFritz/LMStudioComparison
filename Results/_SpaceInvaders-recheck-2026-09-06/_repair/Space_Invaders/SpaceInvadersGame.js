import * as THREE from 'three';
import { GameEngine } from '/shared/engine/GameEngine.js';
import { Renderer } from '/shared/engine/Renderer.js';
import { PostProcessing } from '/shared/engine/PostProcessing.js';
import { InputManager } from '/shared/input/InputManager.js';
import { AudioSynth } from '/shared/audio/AudioSynth.js';
import { ParticleManager } from '/shared/particles/ParticleManager.js';
import { CameraShake } from '/shared/vfx/CameraShake.js';
import { HitStop } from '/shared/vfx/HitStop.js';
import { FloatingText } from '/shared/vfx/FloatingText.js';
import { AABB } from '/shared/math/AABB.js';
import { ProjectilePool } from '/shared/pool/ProjectilePool.js';
import { EntityPool } from '/shared/pool/EntityPool.js';
import { PlayerShip } from './entities/PlayerShip.js';
import { Invader } from './entities/Invader.js';
import { Projectile } from './entities/Projectile.js';
import { ShieldBlock } from './entities/ShieldBlock.js';
import { UFO } from './entities/UFO.js';
import { ScoreHUD } from './components/ScoreHUD.js';

const INVADER_COLS = 11;
const INVADER_ROWS = 5;
const INVADER_SPACING_X = 1.8;
const INVADER_SPACING_Y = 1.6;
const INVADER_START_X = -((INVADER_COLS - 1) * INVADER_SPACING_X) / 2;
const INVADER_START_Z = -4;
const SHIELD_BLOCK_COUNT = 40;
const MAX_PROJECTILES = 20;
const MAX_INVADERS = INVADER_COLS * INVADER_ROWS;

export class SpaceInvadersGame {
  constructor(canvasElement) {
    this.canvasElement = canvasElement;
    this.clock = new THREE.Clock();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.postProcessing = null;
    this.engine = null;

    this.inputManager = new InputManager(canvasElement);
    this.audioSynth = new AudioSynth();
    this.particleManager = new ParticleManager(500);
    this.cameraShake = new CameraShake();
    this.hitStop = new HitStop();
    this.floatingText = new FloatingText(canvasElement);

    this.projectilePool = new ProjectilePool(MAX_PROJECTILES);
    this.entityPool = new EntityPool(MAX_INVADERS + 10);

    this.player = null;
    this.invaders = [];
    this.invaderProjectiles = [];
    this.shieldBlocks = [];
    this.ufo = null;
    this.starfieldNear = null;
    this.starfieldMid = null;
    this.starfieldFar = null;

    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.gameState = 'MENU'; // MENU, PLAYING, GAME_OVER, WAVE_TRANSITION

    this.invaderDirection = 1;
    this.invaderSpeed = 0.02;
    this.invaderMoveTimer = 0;
    this.invaderMoveInterval = 0.5;
    this.shootCooldown = 0;
    this.shootCooldownMax = 0.3;
    this.ufoSpawnTimer = 0;
    this.ufoSpawnInterval = 20;

    this.waveTransitionTimer = 0;
    this.waveTransitionDuration = 2.5;

    this.hud = null;
    this.groundGrid = null;
    this.ambientLight = null;
    this.directionalLight = null;

    this.invaderMarchPhase = 0;
    this.invaderMarchSpeed = 0.5;
    this.marchMusicTimer = 0;
    this.melodyStep = 0;
    this.baseMelodyInterval = 0.18;

    this.interruptedByProjectile = false;
    this.playerHitCooldown = 0;

    this.disposeList = [];
  }

  async init() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000011, 0.035);

    this.camera = new THREE.PerspectiveCamera(60, this.canvasElement.clientWidth / this.canvasElement.clientHeight, 0.1, 100);
    this.camera.position.set(0, 10, 12);
    this.camera.lookAt(0, 0, -2);

    this.renderer = new Renderer(this.canvasElement, this.scene, this.camera);
    this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);

    this.engine = new GameEngine((delta) => this.update(delta), (delta) => this.renderPass(delta));

    this.setupLighting();
    this.createStarfield();
    this.createGroundGrid();
    this.setupInput();

    this.player = new PlayerShip(0, 0, 5);
    this.scene.add(this.player.mesh);

    this.hud = new ScoreHUD();
    this.updateHUD();

    this.audioSynth.init();
    this.playMenuMusic();

    this.gameState = 'MENU';
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x111133, 0.6);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0x4444aa, 0.8);
    this.directionalLight.position.set(5, 10, 5);
    this.scene.add(this.directionalLight);

    const pointLight = new THREE.PointLight(0x00aaff, 2, 30);
    pointLight.position.set(0, 8, 0);
    this.scene.add(pointLight);
    this.disposeList.push(pointLight);
  }

  createStarfield() {
    const createLayer = (count, spread, speed, size, color) => {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * spread;
        positions[i * 3 + 1] = Math.random() * spread * 0.5 + 2;
        positions[i * 3 + 2] = -(Math.random() * spread);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.7 });
      const points = new THREE.Points(geo, mat);
      this.scene.add(points);
      return { mesh: points, speed, baseZ: 0 };
    };

    this.starfieldFar = createLayer(200, 60, 0.5, 0.15, 0x4444ff);
    this.starfieldMid = createLayer(100, 40, 1.5, 0.25, 0x8888ff);
    this.starfieldNear = createLayer(50, 30, 3, 0.4, 0xaaccff);
  }

  createGroundGrid() {
    const gridHelper = new THREE.GridHelper(40, 40, 0x00aaff, 0x002244);
    gridHelper.position.y = -1;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    this.scene.add(gridHelper);
    this.groundGrid = gridHelper;
  }

  setupInput() {
    this.inputManager.registerAxis('LEFT', ['KeyA', 'ArrowLeft']);
    this.inputManager.registerAxis('RIGHT', ['KeyD', 'ArrowRight']);
    this.inputManager.registerButton('SHOOT', ['Space']);
    this.inputManager.registerButton('START', ['Enter']);
  }

  createInvaders() {
    for (let row = 0; row < INVADER_ROWS; row++) {
      for (let col = 0; col < INVADER_COLS; col++) {
        const x = INVADER_START_X + col * INVADER_SPACING_X;
        const z = INVADER_START_Z - row * INVADER_SPACING_Y;
        let type = 'grunt';
        if (row === 0) type = 'top';
        else if (row <= 2) type = 'mid';

        const invader = new Invader(x, 0, z, type);
        this.scene.add(invader.mesh);
        this.invaders.push(invader);
      }
    }
  }

  createShields() {
    const shieldPositions = [];
    const shieldSpacing = 5;
    for (let s = 0; s < 4; s++) {
      const baseX = -shieldSpacing + s * shieldSpacing;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 8; col++) {
          if (row === 0 && (col < 2 || col > 5)) continue;
          if (row === 1 && (col >= 3 && col <= 4)) continue;
          const x = baseX + (col - 3.5) * 0.3;
          const y = row * 0.3;
          shieldPositions.push([x, y, 2]);
        }
      }
    }

    for (const [x, y, z] of shieldPositions) {
      const block = new ShieldBlock(x, y, z);
      this.scene.add(block.mesh);
      this.shieldBlocks.push(block);
    }
  }

  startWave() {
    this.invaders = [];
    this.invaderProjectiles = [];
    this.shieldBlocks = [];
    if (this.ufo) {
      this.scene.remove(this.ufo.mesh);
      this.ufo.dispose();
      this.ufo = null;
    }

    this.createInvaders();
    this.createShields();

    this.invaderDirection = 1;
    const speedMultiplier = 1 + (this.wave - 1) * 0.35;
    this.invaderSpeed = 0.02 * speedMultiplier;
    this.invaderMoveInterval = Math.max(0.08, 0.5 - (this.wave - 1) * 0.06);
    this.shootCooldownMax = Math.max(0.12, 0.3 - (this.wave - 1) * 0.025);

    this.invaderMoveTimer = 0;
    this.ufoSpawnTimer = 0;
    this.interruptedByProjectile = false;

    this.gameState = 'PLAYING';
    this.audioSynth.playWaveStart();
  }

  update(delta) {
    if (this.hitStop.isActive()) return;

    const effectiveDelta = delta * this.engine.getTimescale();

    if (this.gameState === 'MENU') {
      this.updateMenu(effectiveDelta);
      return;
    }

    if (this.gameState === 'WAVE_TRANSITION') {
      this.waveTransitionTimer -= effectiveDelta;
      if (this.waveTransitionTimer <= 0) {
        this.startWave();
      }
      return;
    }

    if (this.gameState !== 'PLAYING') return;

    this.updatePlayer(effectiveDelta);
    this.updateInvaders(effectiveDelta);
    this.updateProjectiles(effectiveDelta);
    this.updateShieldBlocks(effectiveDelta);
    this.updateUFO(effectiveDelta);
    this.updateStarfield(effectiveDelta);
    this.updateMarchMusic(effectiveDelta);
    this.playerHitCooldown = Math.max(0, this.playerHitCooldown - effectiveDelta);

    if (this.invaders.length === 0 && this.gameState === 'PLAYING') {
      this.wave++;
      this.gameState = 'WAVE_TRANSITION';
      this.waveTransitionTimer = this.waveTransitionDuration;
      this.floatingText.add(this.scene, this.camera, `WAVE ${this.wave}`, new THREE.Vector3(0, 4, -2), '#00ffaa', 1.5);
    }

    this.updateHUD();
  }

  updateMenu(delta) {
    if (this.inputManager.isJustPressed('START')) {
      this.resetGame();
      this.startWave();
    }
  }

  resetGame() {
    for (const inv of this.invaders) {
      this.scene.remove(inv.mesh);
      inv.dispose();
    }
    this.invaders = [];
    for (const proj of this.invaderProjectiles) {
      this.scene.remove(proj.mesh);
      proj.dispose();
    }
    this.invaderProjectiles = [];
    for (const block of this.shieldBlocks) {
      this.scene.remove(block.mesh);
      block.dispose();
    }
    this.shieldBlocks = [];
    if (this.ufo) {
      this.scene.remove(this.ufo.mesh);
      this.ufo.dispose();
      this.ufo = null;
    }

    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.player.resetPosition();
    this.playerHitCooldown = 0;
    this.interruptedByProjectile = false;
  }

  updatePlayer(delta) {
    const moveInput = this.inputManager.getAxisValue('LEFT') - this.inputManager.getAxisValue('RIGHT');
    const speed = 6 * delta;
    this.player.move(moveInput * speed);

    if (this.inputManager.isPressed('SHOOT') && this.shootCooldown <= 0 && !this.interruptedByProjectile) {
      this.shoot();
      this.shootCooldown = this.shootCooldownMax;
    }
    this.shootCooldown = Math.max(0, this.shootCooldown - delta);

    if (this.playerHitCooldown > 0) {
      this.player.setInvincible(true);
    } else {
      this.player.setInvincible(false);
    }
  }

  shoot() {
    const proj = this.projectilePool.acquire();
    proj.init(this.player.mesh.position.x, this.player.mesh.position.z + 0.5, -12, true);
    this.scene.add(proj.mesh);
    this.audioSynth.playPlayerShoot();
  }

  updateInvaders(delta) {
    if (this.invaders.length === 0) return;

    let allOnGround = true;
    for (const inv of this.invaders) {
      const worldPos = new THREE.Vector3();
      inv.mesh.getWorldPosition(worldPos);
      if (worldPos.z > -8) {
        allOnGround = false;
        break;
      }
    }

    if (!allOnGround) {
      this.killPlayer();
      return;
    }

    let edgeDetected = false;
    for (const inv of this.invaders) {
      const worldPos = new THREE.Vector3();
      inv.mesh.getWorldPosition(worldPos);
      if ((worldPos.x >= 10 && this.invaderDirection > 0) || (worldPos.x <= -10 && this.invaderDirection < 0)) {
        edgeDetected = true;
        break;
      }
    }

    if (edgeDetected) {
      this.invaderDirection *= -1;
      for (const inv of this.invaders) {
        inv.mesh.position.z += 0.4;
        const worldPos = new THREE.Vector3();
        inv.mesh.getWorldPosition(worldPos);
        if (worldPos.z > -8) {
          this.killPlayer();
          return;
        }
      }
    }

    for (const inv of this.invaders) {
      inv.mesh.position.x += this.invaderDirection * this.invaderSpeed;
    }

    this.invaderMoveTimer += delta;
    if (this.invaderMoveTimer >= this.invaderMoveInterval) {
      this.invaderMoveTimer = 0;
      for (const inv of this.invaders) {
        inv.animateStep();
      }
      this.tryInvaderShoot();
    }

    this.invaderMarchPhase += delta * this.invaderMarchSpeed;
  }

  tryInvaderShoot() {
    const aliveInvaders = [...this.invaders];
    if (aliveInvaders.length === 0) return;

    const bottomInvaders = new Map();
    for (const inv of aliveInvaders) {
      const key = Math.round(inv.mesh.position.x / INVADER_SPACING_X);
      if (!bottomInvaders.has(key) || inv.getGridRow() > bottomInvaders.get(key).getGridRow()) {
        bottomInvaders.set(key, inv);
      }
    }

    const shooters = [...bottomInvaders.values()];
    const shooter = shooters[Math.floor(Math.random() * shooters.length)];
    if (!shooter) return;

    const proj = this.projectilePool.acquire();
    const sx = shooter.mesh.position.x;
    const sz = shooter.mesh.position.z + 0.5;
    proj.init(sx, sz, 6, false);
    this.scene.add(proj.mesh);
    this.invaderProjectiles.push(proj);

    if (Math.random() < 0.15 && !this.ufo) {
      this.spawnUFO();
    }
  }

  updateProjectiles(delta) {
    for (let i = this.projectilePool.pool.length - 1; i >= 0; i--) {
      const proj = this.projectilePool.pool[i];
      if (!proj.active) continue;

      proj.update(delta);

      if (proj.isPlayerProjectile()) {
        let hit = false;
        for (let j = this.invaders.length - 1; j >= 0; j--) {
          const inv = this.invaders[j];
          if (AABB.intersects(proj.getAABB(), inv.getAABB())) {
            this.destroyInvader(inv, j);
            hit = true;
            break;
          }
        }

        if (!hit && this.ufo && proj.isPlayerProjectile() && AABB.intersects(proj.getAABB(), this.ufo.getAABB())) {
          this.hitUFO();
          hit = true;
        }

        if (!hit) {
          for (let k = this.shieldBlocks.length - 1; k >= 0; k--) {
            const block = this.shieldBlocks[k];
            if (block.active && AABB.intersects(proj.getAABB(), block.getAABB())) {
              block.takeDamage();
              hit = true;
              if (!block.active) {
                this.scene.remove(block.mesh);
                this.shieldBlocks.splice(k, 1);
              }
              break;
            }
          }
        }

        if (hit) {
          proj.deactivate();
          this.scene.remove(proj.mesh);
        } else if (proj.mesh.position.z < -20 || proj.mesh.position.z > 15) {
          proj.deactivate();
          this.scene.remove(proj.mesh);
        }
      } else {
        let hit = false;
        if (!this.player.isInvincible() && AABB.intersects(proj.getAABB(), this.player.getAABB())) {
          this.killPlayer();
          hit = true;
        }

        if (!hit) {
          for (let k = this.shieldBlocks.length - 1; k >= 0; k--) {
            const block = this.shieldBlocks[k];
            if (block.active && AABB.intersects(proj.getAABB(), block.getAABB())) {
              block.takeDamage();
              hit = true;
              if (!block.active) {
                this.scene.remove(block.mesh);
                this.shieldBlocks.splice(k, 1);
              }
              break;
            }
          }
        }

        if (hit) {
          proj.deactivate();
          this.scene.remove(proj.mesh);
        } else if (proj.mesh.position.z > 15 || proj.mesh.position.z < -20) {
          proj.deactivate();
          this.scene.remove(proj.mesh);
        }
      }
    }

    for (let i = this.invaderProjectiles.length - 1; i >= 0; i--) {
      const proj = this.invaderProjectiles[i];
      if (!proj.active) {
        this.invaderProjectiles.splice(i, 1);
      }
    }
  }

  destroyInvader(invader, index) {
    this.scene.remove(invader.mesh);
    invader.dispose();
    this.invaders.splice(index, 1);

    const points = invader.getPoints();
    this.score += points;

    const pos = new THREE.Vector3();
    invader.mesh.getWorldPosition(pos);

    this.particleManager.spawnBurst(pos.x, pos.y, pos.z, invader.getColor(), 25);
    this.cameraShake.addTrauma(4.0);
    this.hitStop.trigger(0.06);
    this.audioSynth.playInvaderKill(invader.getType());

    const screenPos = new THREE.Vector3(pos.x, pos.y + 1.5, pos.z);
    this.floatingText.add(this.scene, this.camera, `+${points}`, screenPos, invader.getGlowColor(), 0.8);
  }

  hitUFO() {
    if (!this.ufo) return;

    const points = this.ufo.getPoints();
    this.score += points;

    const pos = new THREE.Vector3();
    this.ufo.mesh.getWorldPosition(pos);

    this.particleManager.spawnBurst(pos.x, pos.y, pos.z, 0xff4444, 40);
    this.cameraShake.addTrauma(6.0);
    this.hitStop.trigger(0.1);
    this.audioSynth.playUFOKill();

    this.scene.remove(this.ufo.mesh);
    this.ufo.dispose();
    this.ufo = null;

    const screenPos = new THREE.Vector3(pos.x, pos.y + 2, pos.z);
    this.floatingText.add(this.scene, this.camera, `+${points}`, screenPos, '#ff4444', 1.0);
  }

  spawnUFO() {
    const side = Math.random() < 0.5 ? -1 : 1;
    this.ufo = new UFO(side * 15, 0, -3);
    this.scene.add(this.ufo.mesh);
    this.audioSynth.playUFOSpawn();
  }

  updateShieldBlocks(delta) {
    for (const block of this.shieldBlocks) {
      if (!block.active) continue;
      const worldPos = new THREE.Vector3();
      block.mesh.getWorldPosition(worldPos);
      if (worldPos.z > -8) {
        block.takeDamage();
        this.scene.remove(block.mesh);
        const idx = this.shieldBlocks.indexOf(block);
        if (idx >= 0) this.shieldBlocks.splice(idx, 1);
      }
    }
  }

  updateUFO(delta) {
    if (!this.ufo) return;
    this.ufo.update(delta);
    if (this.ufo.mesh.position.x > 20 || this.ufo.mesh.position.x < -20) {
      this.scene.remove(this.ufo.mesh);
      this.ufo.dispose();
      this.ufo = null;
    }
  }

  updateStarfield(delta) {
    const updateLayer = (layer) => {
      if (!layer) return;
      const positions = layer.mesh.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 2] += layer.speed * delta;
        if (positions[i + 2] > 20) {
          positions[i + 2] -= 40;
        }
      }
      layer.mesh.geometry.attributes.position.needsUpdate = true;
    };

    updateLayer(this.starfieldFar);
    updateLayer(this.starfieldMid);
    updateLayer(this.starfieldNear);
  }

  updateMarchMusic(delta) {
    this.marchMusicTimer += delta;
    if (this.marchMusicTimer >= this.baseMelodyInterval / (1 + (this.wave - 1) * 0.2)) {
      this.marchMusicTimer = 0;
      const melody = [130.81, 146.83, 164.81, 174.61, 196, 174.61, 164.81, 146.83];
      const freq = melody[this.melodyStep % melody.length];
      this.audioSynth.playMarchNote(freq);
      this.melodyStep++;
    }
  }

  killPlayer() {
    if (this.playerHitCooldown > 0) return;

    this.lives--;

    const pos = new THREE.Vector3();
    this.player.mesh.getWorldPosition(pos);

    this.particleManager.spawnBurst(pos.x, pos.y, pos.z, 0x00aaff, 50);
    this.cameraShake.addTrauma(12.0);
    this.hitStop.trigger(0.15);
    this.audioSynth.playPlayerDeath();

    if (this.lives <= 0) {
      this.gameState = 'GAME_OVER';
      this.floatingText.add(this.scene, this.camera, 'GAME OVER', new THREE.Vector3(0, 4, -2), '#ff0044', 2.5);
      this.audioSynth.playGameOver();
    } else {
      this.playerHitCooldown = 2.0;
      this.interruptedByProjectile = true;
      setTimeout(() => {
        this.interruptedByProjectile = false;
      }, 1500);
    }

    this.updateHUD();
  }

  renderPass(delta) {
    if (this.gameState === 'MENU') {
      const t = this.clock.getElapsedTime();
      this.camera.position.x = Math.sin(t * 0.3) * 2;
      this.camera.lookAt(0, 0, -2);
    }

    this.postProcessing.render(delta);
  }

  updateHUD() {
    if (this.hud) {
      this.hud.update(this.score, this.lives, this.wave);
    }
  }

  dispose() {
    for (const inv of this.invaders) {
      this.scene.remove(inv.mesh);
      inv.dispose();
    }
    for (const proj of this.projectilePool.pool) {
      if (proj.active) {
        this.scene.remove(proj.mesh);
        proj.dispose();
      }
    }
    for (const proj of this.invaderProjectiles) {
      this.scene.remove(proj.mesh);
      proj.dispose();
    }
    for (const block of this.shieldBlocks) {
      this.scene.remove(block.mesh);
      block.dispose();
    }
    if (this.ufo) {
      this.scene.remove(this.ufo.mesh);
      this.ufo.dispose();
    }

    this.player.dispose();
    this.particleManager.dispose();
    this.projectilePool.dispose();

    for (const obj of this.disposeList) {
      this.scene.remove(obj);
    }

    if (this.hud) {
      this.hud.dispose();
    }

    this.engine.stop();
  }
}
