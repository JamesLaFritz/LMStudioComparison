import * as THREE from 'three';
import { EventBus } from '../../shared/core/EventBus.js';
import { CONFIG } from './config.js';
import { PlayerShip } from './entities/PlayerShip.js';
import { AlienGrid } from './entities/AlienGrid.js';
import { Shields } from './entities/Shields.js';
import { Bullets } from './entities/Bullets.js';
import { MysteryShip } from './entities/MysteryShip.js';
import { PowerUps } from './entities/PowerUps.js';
import { BossAlien } from './entities/BossAlien.js';
import { CollisionManager } from './collision/CollisionManager.js';
import { setupVFX } from './vfx/SpaceInvadersVFX.js';
import { setupAudio } from './audio/SpaceInvadersAudio.js';
import { SpaceInvadersUI } from './ui/SpaceInvadersUI.js';

export default class SpaceInvadersGame {
  constructor(sceneManager, input) {
    this.scene = sceneManager.scene;
    this.camera = sceneManager.camera;
    this.renderer = sceneManager.renderer;
    this.input = input;
    this.bus = new EventBus();

    this.state = 'MENU';
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.wave = 1;
    this.waveTransitionTimer = 0;
    this.elapsed = 0;

    this.player = null;
    this.alienGrid = null;
    this.shields = null;
    this.bullets = null;
    this.mysteryShip = null;
    this.powerUps = null;
    this.bossAlien = null;
    this.collisionManager = null;

    this.starfield = null;
    this.nebula = null;
    this.playerLight = null;

    this.vfx = null;
    this.audio = null;
    this.ui = null;

    this._init();
  }

  _init() {
    this.ui = new SpaceInvadersUI();
    this.vfx = setupVFX(this.scene, this.bus, CONFIG);
    this.audio = setupAudio(this.bus);
    this.collisionManager = new CollisionManager(this.bus, CONFIG);

    this._createEnvironment();
    this._createEntities();
    this._setupInput();
    this.ui.setState('MENU');
  }

  _createEnvironment() {
    const nebulaGeo = new THREE.PlaneGeometry(40, 30);
    const nebulaMat = new THREE.MeshStandardMaterial({
      color: 0x1a0033,
      emissive: 0x110022,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    });
    this.nebula = new THREE.Mesh(nebulaGeo, nebulaMat);
    this.nebula.position.z = -15;
    this.scene.add(this.nebula);

    this.starfield = this._createStarfield();
    this.scene.add(this.starfield);

    this.playerLight = new THREE.PointLight(0x00ffff, 2, 8);
    this.scene.add(this.playerLight);
  }

  _createStarfield() {
    const group = new THREE.Group();
    const counts = [800, 600, 400];
    const sizes = [0.02, 0.04, 0.06];
    const speeds = [0.02, 0.04, 0.06];

    for (let layer = 0; layer < 3; layer++) {
      const count = counts[layer];
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 2] = -5 - Math.random() * 10;

        const brightness = 0.3 + Math.random() * 0.7;
        colors[i * 3] = brightness;
        colors[i * 3 + 1] = brightness;
        colors[i * 3 + 2] = brightness + Math.random() * 0.2;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: sizes[layer],
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geo, mat);
      points.userData.driftSpeed = speeds[layer];
      group.add(points);
    }

    return group;
  }

  _createEntities() {
    this.player = new PlayerShip(this.scene, this.input, this.bus, CONFIG);
    this.alienGrid = new AlienGrid(this.scene, CONFIG, this.bus);
    this.shields = new Shields(this.scene, CONFIG);
    this.bullets = new Bullets(this.scene, CONFIG, this.bus);
    this.mysteryShip = new MysteryShip(this.scene, CONFIG, this.bus);
    this.powerUps = new PowerUps(this.scene, CONFIG, this.bus);
  }

  _setupInput() {
    this.bus.on('input:fire', () => {
      if (this.state === 'MENU') {
        this._startGame();
      } else if (this.state === 'GAME_OVER') {
        this._resetToMenu();
      }
    });

    this.bus.on('input:special', () => {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
        this.ui.setState('PAUSED');
      } else if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        this.ui.setState('PLAYING');
      }
    });
  }

  _startGame() {
    this.state = 'PLAYING';
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.wave = 1;
    this.player.reset();
    this.shields.reset();
    this.alienGrid.spawnWave(this.wave);
    this.mysteryShip.reset();
    this.powerUps.clear();
    this.bullets.clear();
    this.ui.setState('PLAYING');
    this.ui.updateScore(0, 0, 1);
    this.ui.updateHealth(this.player.hp, this.player.maxHp);
    this.audio.playWaveTransition();
  }

  _resetToMenu() {
    this.state = 'MENU';
    this.alienGrid.reset();
    this.player.reset();
    this.shields.reset();
    this.bullets.clear();
    this.mysteryShip.destroy();
    this.powerUps.clear();
    if (this.bossAlien) {
      this.bossAlien.dispose();
      this.bossAlien = null;
    }
    this.ui.hide();
    this.ui.setState('MENU');
  }

  _nextWave() {
    this.wave++;
    this.state = 'WAVE_TRANSITION';
    this.waveTransitionTimer = 2.0;
    this.player.reset();
    this.shields.reset();
    this.bullets.clear();
    this.powerUps.clear();
    this.alienGrid.reset();
    if (this.bossAlien) {
      this.bossAlien.dispose();
      this.bossAlien = null;
    }
    this.ui.setState('WAVE_TRANSITION');
    this.ui.updateScore(this.score, this.combo, this.wave);
    this.audio.playWaveTransition();
    this.vfx.cameraShake.addTrauma(0.3);
  }

  _gameOver() {
    this.state = 'GAME_OVER';
    this.ui.showGameOver(this.score);
    this.audio.playGameOver();
    this.vfx.cameraShake.addTrauma(0.8);
    this.vfx.hitStop.trigger(0.3);
  }

  _addScore(points, position) {
    this.combo++;
    this.comboTimer = 5.0;
    const multiplier = Math.min(3.0, 1.0 + (this.combo - 1) * 0.1);
    const totalPoints = Math.round(points * multiplier);
    this.score += totalPoints;
    this.ui.updateScore(this.score, this.combo, this.wave);
    this.vfx.scoreText.spawn(position, `+${totalPoints}`, 0xffffff);
  }

  update(dt) {
    if (this.state === 'MENU' || this.state === 'GAME_OVER') {
      this._updateStarfield(dt);
      return;
    }

    if (this.state === 'PAUSED') {
      return;
    }

    if (this.state === 'WAVE_TRANSITION') {
      this.waveTransitionTimer -= dt;
      this._updateStarfield(dt);
      if (this.waveTransitionTimer <= 0) {
        this.state = 'PLAYING';
        this.ui.setState('PLAYING');
        if (this.wave % 5 === 0) {
          this._spawnBoss();
        } else {
          this.alienGrid.spawnWave(this.wave);
        }
        this.mysteryShip.reset();
      }
      return;
    }

    this.elapsed += dt;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.ui.updateScore(this.score, 0, this.wave);
      }
    }

    this.player.update(dt);
    this.alienGrid.update(dt, this.elapsed);
    this.bullets.update(dt);
    this.mysteryShip.update(dt);
    this.powerUps.update(dt);

    if (this.bossAlien && this.bossAlien.alive) {
      this.bossAlien.update(dt, this.elapsed);
    }

    this._checkCollisions();

    if (this.alienGrid.aliveCount === 0 && (!this.bossAlien || !this.bossAlien.alive)) {
      this._nextWave();
    }

    const aliens = this.alienGrid.aliens;
    for (const alien of aliens) {
      if (!alien.isDead() && alien.position.y < -2.5) {
        this._gameOver();
        return;
      }
    }

    if (this.playerLight) {
      this.playerLight.position.copy(this.player.position);
      this.playerLight.position.y += 0.5;
    }

    this._updateStarfield(dt);
  }

  _checkCollisions() {
    const playerBullets = this.bullets.playerBullets;
    const alienBullets = this.bullets.alienBullets;
    const aliens = this.alienGrid.aliens;

    for (const bullet of playerBullets) {
      if (!bullet.alive) continue;
      for (const alien of aliens) {
        if (alien.isDead()) continue;
        if (this._aabbTest(bullet, alien)) {
          bullet.alive = false;
          alien.takeDamage();
          if (alien.isDead()) {
            this._addScore(CONFIG.alienTypes[alien.type].points, alien.position);
            this.bus.emit('alienDeath', { position: alien.position.clone(), type: alien.type });
            if (Math.random() < 0.05) {
              this.powerUps.spawn(alien.position);
            }
          }
          break;
        }
      }
    }

    if (this.mysteryShip.active) {
      for (const bullet of playerBullets) {
        if (!bullet.alive) continue;
        if (this._aabbTest(bullet, this.mysteryShip)) {
          bullet.alive = false;
          this.mysteryShip.destroy();
          this.bus.emit('mystery:death', { position: this.mysteryShip.position.clone() });
          const points = this.mysteryShip.points || 300;
          this._addScore(points, this.mysteryShip.position);
          break;
        }
      }
    }

    if (this.bossAlien && this.bossAlien.alive) {
      for (const bullet of playerBullets) {
        if (!bullet.alive) continue;
        if (this._aabbTest(bullet, this.bossAlien)) {
          bullet.alive = false;
          this.bossAlien.takeDamage();
          this.bus.emit('boss:hit', { position: this.bossAlien.position.clone() });
          if (!this.bossAlien.alive) {
            this._addScore(1000, this.bossAlien.position);
            this.bus.emit('boss:death', { position: this.bossAlien.position.clone() });
          }
          break;
        }
      }
    }

    for (const bullet of playerBullets) {
      if (!bullet.alive) continue;
      if (this.shields.checkCollision(bullet.position)) {
        bullet.alive = false;
        this.shields.destroyAt(bullet.position, 0.3);
        this.bus.emit('shield:hit', { position: bullet.position.clone() });
      }
    }

    for (const bullet of alienBullets) {
      if (!bullet.alive) continue;
      if (this._aabbTest(bullet, this.player) && !this.player.invulnerable) {
        bullet.alive = false;
        this.player.takeDamage();
        this.bus.emit('player:hit', { position: this.player.position.clone() });
        this.ui.updateHealth(this.player.hp, this.player.maxHp);
        if (this.player.hp <= 0) {
          this._gameOver();
          return;
        }
        break;
      }
    }

    for (const bullet of alienBullets) {
      if (!bullet.alive) continue;
      if (this.shields.checkCollision(bullet.position)) {
        bullet.alive = false;
        this.shields.destroyAt(bullet.position, 0.3);
        this.bus.emit('shield:hit', { position: bullet.position.clone() });
      }
    }

    for (const alien of aliens) {
      if (alien.isDead()) continue;
      if (this.shields.checkCollision(alien.position)) {
        this.shields.destroyAt(alien.position, 0.5);
      }
    }

    this.powerUps.collect(this.player.position);

    for (const pBullet of playerBullets) {
      if (!pBullet.alive) continue;
      for (const aBullet of alienBullets) {
        if (!aBullet.alive) continue;
        if (this._aabbTest(pBullet, aBullet)) {
          pBullet.alive = false;
          aBullet.alive = false;
          this.bus.emit('bullet:collision', { position: pBullet.position.clone() });
          break;
        }
      }
    }
  }

  _aabbTest(a, b) {
    const aHalf = a.halfSize || 0.2;
    const bHalf = b.halfSize || 0.2;
    const aPos = a.position;
    const bPos = b.position;

    return (
      Math.abs(aPos.x - bPos.x) < (aHalf + bHalf) &&
      Math.abs(aPos.y - bPos.y) < (aHalf + bHalf)
    );
  }

  _spawnBoss() {
    this.bossAlien = new BossAlien(this.scene, CONFIG, this.bus);
    this.bossAlien.spawn();
  }

  _updateStarfield(dt) {
    if (!this.starfield) return;
    for (const layer of this.starfield.children) {
      const positions = layer.geometry.attributes.position.array;
      const speed = layer.userData.driftSpeed || 0.02;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= speed * dt;
        if (positions[i] < -10) {
          positions[i] = 10;
        }
      }
      layer.geometry.attributes.position.needsUpdate = true;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.bus.off('*');
    if (this.player) this.player.dispose();
    if (this.alienGrid) this.alienGrid.dispose();
    if (this.shields) this.shields.dispose();
    if (this.bullets) this.bullets.dispose();
    if (this.mysteryShip) this.mysteryShip.dispose();
    if (this.powerUps) this.powerUps.dispose();
    if (this.bossAlien) this.bossAlien.dispose();
    if (this.starfield) {
      for (const child of this.starfield.children) {
        child.geometry.dispose();
        child.material.dispose();
      }
      this.starfield.dispose();
    }
    if (this.nebula) {
      this.nebula.geometry.dispose();
      this.nebula.material.dispose();
    }
    if (this.playerLight) {
      this.playerLight.dispose();
    }
    if (this.vfx) this.vfx.dispose();
    if (this.audio) this.audio.dispose();
    if (this.ui) this.ui.dispose();
  }
}
