// Space_Invaders/Game.js — main game logic
import * as THREE from 'three';
import { Player } from './entities/Player.js';
import { AlienGrid } from './entities/AlienGrid.js';
import { ProjectileManager } from './entities/Projectile.js';
import { Barrier } from './entities/Barrier.js';
import { UFO } from './entities/UFO.js';
import { LevelGenerator } from './levels/LevelGenerator.js';
import { HUD } from './ui/HUD.js';
import { createStarfield, createGroundPlane } from '../shared/graphics/ProceduralAssets.js';

const ARENA_HALF_W = 12;
const ARENA_HALF_H = 14;
const BARRIER_POSITIONS = [-5, -1.67, 1.67, 5];

export class Game {
    constructor(engine) {
        this.engine = engine;
        this.scene = engine.scene;
        this.camera = engine.camera;

        // Game state
        this.score = 0;
        this.wave = 1;
        this.state = 'MENU'; // MENU | PLAY | PAUSE | GAME_OVER | LEVEL_TRANSITION
        this.transitionTimer = 0;
        this.transitionDuration = 2.0;

        // Entities
        this.player = null;
        this.alienGrid = null;
        this.projectiles = null;
        this.barriers = [];
        this.ufo = null;

        // Scene decorations
        this.starfield = null;
        this.groundPlane = null;

        // Level config
        this.levelGen = new LevelGenerator();

        // HUD
        this.hud = null;

        // Input
        this.input = null;

        // Audio
        this.audio = null;

        // VFX
        this.particles = null;
        this.cameraShake = null;
        this.hitStop = null;
        this.shockwaves = null;
        this.floatingText = null;
        this.motionTrails = null;
    }

    init() {
        this.input = this.engine.input;
        this.audio = this.engine.audio;
        this.particles = this.engine.particleManager;
        this.cameraShake = this.engine.cameraShake;
        this.hitStop = this.engine.hitStop;
        this.shockwaves = this.engine.shockwaveRings;
        this.floatingText = this.engine.floatingText;
        this.motionTrails = this.engine.motionTrails;

        // Build scene
        this._buildScene();

        // Build HUD
        this.hud = new HUD();
        this.hud.showMenu();

        // Start in menu
        this.state = 'MENU';
    }

    _buildScene() {
        // Starfield
        this.starfield = createStarfield(this.scene, 500, 80);

        // Ground plane
        this.groundPlane = createGroundPlane(this.scene, 60, 40, 30);
    }

    _startGame() {
        this.score = 0;
        this.wave = 1;
        this._startWave();
        this.state = 'PLAY';
        this.hud.showGame();
        this.hud.updateScore(this.score);
        this.hud.updateLives(3);
        this.hud.updateWave(this.wave);
        this.audio?.playSFX('menu');
    }

    _startWave() {
        // Clean up previous wave
        if (this.alienGrid) this.alienGrid.dispose();
        this.barriers.forEach(b => { this.scene.remove(b.group); b.dispose(); });
        this.barriers = [];

        // Get level config
        const config = this.levelGen.generate(this.wave);

        // Create player
        this.player = new Player({
            position: [0, -8],
            moveSpeed: config.playerSpeed || 300,
            fireRate: config.fireRate || 0.25,
            lives: this.player ? this.player.lives : 3,
            arenaBounds: [-ARENA_HALF_W, ARENA_HALF_W],
        });
        this.scene.add(this.player.mesh);

        // Register player for motion trails
        if (this.motionTrails) {
            this.motionTrails.register(this.player, 8, 0x00ffff, 0.15, 0.2);
        }

        // Create alien grid
        this.alienGrid = new AlienGrid(this.scene, this.wave);

        // Create projectile manager
        this.projectiles = new ProjectileManager();
        this.projectiles.setBounds(ARENA_HALF_H);

        // Create barriers
        for (const bx of BARRIER_POSITIONS) {
            const barrier = new Barrier(bx);
            this.scene.add(barrier.group);
            this.barriers.push(barrier);
        }

        // Create UFO
        this.ufo = new UFO(this.scene,
            (pts, pos) => this._onUFOHit(pts, pos),
            (pos) => this._onUFODeath(pos)
        );

        this.hud.updateWave(this.wave);
    }

    _onUFOHit(pts, pos) {
        this.score += pts;
        this.hud.updateScore(this.score);
        this.audio?.playSFX('ufoDeath');
        this.audio?.playSFX('score');
        this._spawnExplosion(pos.x, pos.y, 0xff2222, 30);
        this.cameraShake?.shake(2, 0.3);
        this.floatingText?.spawn(new THREE.Vector3(pos.x, pos.y, 0), `+${pts}`, '#ff4444');
    }

    _onUFODeath(pos) {
        this._spawnExplosion(pos.x, pos.y, 0xff0000, 40);
        this.shockwaves?.emit(new THREE.Vector3(pos.x, pos.y, 0), 5, 0xff0000, 0.8);
    }

    _spawnExplosion(x, y, color, count) {
        if (!this.particles) return;
        this.particles.burst(
            new THREE.Vector3(x, y, 0),
            count, 0.5,
            typeof color === 'string' ? color : new THREE.Color(color),
            8, 1.0, -2, 2
        );
    }

    update(dt, engine) {
        if (this.state === 'MENU') {
            this._updateMenu(dt);
            return;
        }

        if (this.state === 'GAME_OVER') {
            this._updateGameOver(dt);
            return;
        }

        if (this.state === 'PAUSE') {
            this._updatePause(dt);
            return;
        }

        if (this.state === 'LEVEL_TRANSITION') {
            this._updateTransition(dt);
            return;
        }

        // --- PLAY state ---
        this._updatePlay(dt);
    }

    _updateMenu(dt) {
        if (this.input && this.input.isJustPressed('confirm')) {
            this._startGame();
        }
    }

    _updatePause(dt) {
        if (this.input && this.input.isJustPressed('pause')) {
            this.state = 'PLAY';
            this.hud.showGame();
        }
    }

    _updateGameOver(dt) {
        if (this.input && this.input.isJustPressed('confirm')) {
            this._startGame();
        }
    }

    _updateTransition(dt) {
        this.transitionTimer -= dt;
        if (this.transitionTimer <= 0) {
            this.state = 'PLAY';
            this.hud.showGame();
        }
    }

    _updatePlay(dt) {
        // Pause toggle
        if (this.input && this.input.isJustPressed('pause')) {
            this.state = 'PAUSE';
            this.hud.showPause();
            return;
        }

        // Update player
        this.player.fireCooldown -= dt;
        this.player.update(dt, this.input);

        // Player fire
        if (this.input && this.input.isJustPressed('fire') && this.player.canFire()) {
            const bullet = this.player.fire();
            if (bullet) {
                this.projectiles.spawnPlayerBullet(bullet.position[0], bullet.position[1]);
                this.audio?.playSFX('shoot');
            }
        }

        // Update projectiles
        this.projectiles.update(dt);

        // Update alien grid
        const gridActive = this.alienGrid.update(dt, this.projectiles, (x, y) => {
            this.projectiles.spawnAlienBullet(x, y);
            this.audio?.playSFX('alienShoot');
        });

        // Check projectile vs alien collisions
        const aliveBullets = this.projectiles.getAlive();
        for (let i = aliveBullets.length - 1; i >= 0; i--) {
            const b = aliveBullets[i];
            if (!b.alive || b.owner !== 'player') continue;

            // Check vs aliens
            const hit = this.alienGrid.checkProjectileHit(b.mesh.position.x, b.mesh.position.y);
            if (hit) {
                this.score += hit.points;
                this.hud.updateScore(this.score);
                this._spawnExplosion(hit.x, hit.y, hit.type.color, 15);
                this.shockwaves?.emit(new THREE.Vector3(hit.x, hit.y, 0), 3, hit.type.color, 0.5);
                this.cameraShake?.shake(0.5, 0.15);
                this.floatingText?.spawn(new THREE.Vector3(hit.x, hit.y, 0), `+${hit.points}`, '#00ff00');
                this.audio?.playSFX('alienDeath');
                this.projectiles.release(b);
                continue;
            }

            // Check vs barriers
            let barrierHit = false;
            for (const barrier of this.barriers) {
                if (barrier.checkCollision(b.mesh.position.x, b.mesh.position.y, 0.15, 0.4)) {
                    this._spawnExplosion(b.mesh.position.x, b.mesh.position.y, 0x00ff88, 5);
                    this.projectiles.release(b);
                    barrierHit = true;
                    break;
                }
            }
            if (barrierHit) continue;
        }

        // Check alien bullets vs player
        for (let i = aliveBullets.length - 1; i >= 0; i--) {
            const b = aliveBullets[i];
            if (!b.alive || b.owner !== 'alien') continue;

            // Check vs player
            const dx = b.mesh.position.x - this.player.position[0];
            const dy = b.mesh.position.y - this.player.position[1];
            if (Math.sqrt(dx * dx + dy * dy) < 0.6) {
                const died = this.player.takeDamage();
                this._spawnExplosion(this.player.position[0], this.player.position[1], 0x00ffff, 20);
                this.cameraShake?.shake(1.5, 0.3);
                this.hitStop?.trigger(100);
                this.audio?.playSFX('playerHit');
                this.projectiles.release(b);
                this.hud.updateLives(this.player.lives);

                if (died) {
                    this.audio?.playSFX('gameOver');
                    this.state = 'GAME_OVER';
                    this.hud.showGameOver(this.score);
                }
                continue;
            }

            // Check vs barriers
            for (const barrier of this.barriers) {
                if (barrier.checkCollision(b.mesh.position.x, b.mesh.position.y, 0.12, 0.3)) {
                    this._spawnExplosion(b.mesh.position.x, b.mesh.position.y, 0x00ff88, 5);
                    this.projectiles.release(b);
                    break;
                }
            }
        }

        // Check alien vs player collision
        for (const alien of this.alienGrid.aliens) {
            if (!alien.alive) continue;
            const dx = alien.x - this.player.position[0];
            const dy = alien.y - this.player.position[1];
            if (Math.sqrt(dx * dx + dy * dy) < 1.0) {
                const died = this.player.takeDamage();
                this._spawnExplosion(this.player.position[0], this.player.position[1], 0x00ffff, 25);
                this.cameraShake?.shake(2, 0.4);
                this.hitStop?.trigger(150);
                this.audio?.playSFX('playerHit');
                this.hud.updateLives(this.player.lives);

                if (died) {
                    this.audio?.playSFX('gameOver');
                    this.state = 'GAME_OVER';
                    this.hud.showGameOver(this.score);
                }
                break;
            }
        }

        // Update UFO
        this.ufo.update(dt, this.projectiles.getAlive(), (proj, target) => {
            this.projectiles.release(proj);
        });

        // Check if wave cleared
        if (this.alienGrid.isCleared()) {
            this.audio?.playSFX('waveComplete');
            this.wave++;
            this.transitionTimer = this.transitionDuration;
            this.state = 'LEVEL_TRANSITION';
            this.hud.showLevelTransition(this.wave);
        }
    }

    dispose() {
        if (this.player) this.player.dispose();
        if (this.alienGrid) this.alienGrid.dispose();
        if (this.projectiles) this.projectiles.destroy();
        if (this.ufo) this.ufo.dispose();
        this.barriers.forEach(b => { this.scene.remove(b.group); b.dispose(); });
        this.barriers = [];
        if (this.starfield) {
            this.starfield.mesh.geometry.dispose();
            this.starfield.mesh.material.dispose();
            this.scene.remove(this.starfield.mesh);
        }
        if (this.groundPlane) {
            this.groundPlane.mesh.geometry.dispose();
            this.groundPlane.mesh.material.dispose();
            this.groundPlane.texture?.dispose();
            this.scene.remove(this.groundPlane.mesh);
        }
        if (this.hud) this.hud.dispose();
    }
}