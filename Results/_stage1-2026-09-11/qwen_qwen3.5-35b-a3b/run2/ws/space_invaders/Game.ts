import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { GameLoop } from '../shared/core/GameLoop';
import { InputManager } from '../shared/core/InputManager';
import { ObjectPool } from '../shared/core/ObjectPool';
import { MemoryManager } from '../shared/core/MemoryManager';
import { ParticleSystem } from '../shared/vfx/ParticleSystem';
import { CameraShake } from '../shared/vfx/CameraShake';
import { HitStop } from '../shared/vfx/HitStop';
import { MotionTrailsManager, Color } from '../shared/vfx/MotionTrails';
import { ShockwaveRings } from '../shared/vfx/ShockwaveRings';
import { FloatingText } from '../shared/vfx/FloatingText';

import { Player } from './Entities/Player';
import { Enemy } from './Enemies/Enemy';
import { Boss } from './Enemies/Boss';
import { Bullet } from './Projectiles/Bullet';
import { EnemyType } from '../shared/utils/ProceduralTextures';
import { Powerup, PowerupType } from './Entities/Powerup';
import { CollisionSystem } from './Systems/CollisionSystem';
import { ScoreSystem } from './Systems/ScoreSystem';

export class Game extends GameLoop {
    // Three.js core
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;

    // Systems
    private input: InputManager;
    private collision: CollisionSystem;
    private scoreSystem: ScoreSystem;
    private memory: MemoryManager;

    // VFX systems
    public vfx: {
        particles: ParticleSystem;
        shake: CameraShake;
        hitStop: HitStop;
        trails: MotionTrails;
        shockwaves: ShockwaveRings;
        floatingText: FloatingText;
    };

    // Game entities
    private player: Player | null = null;
    private enemies: Enemy[] = [];
    private bullets: Bullet[] = [];
    private powerups: Powerup[] = [];

    // Pooling
    private enemyPool: ObjectPool<Enemy>;
    private bulletPool: ObjectPool<Bullet>;
    private powerupPool: ObjectPool<Powerup>;

    // Game state
    private gameState: 'menu' | 'playing' | 'gameover' | 'victory' = 'menu';
    private waveNumber: number = 1;
    private lives: number = 3;
    private score: number = 0;
    private highScore: number = parseInt(localStorage.getItem('spaceInvadersHighScore') || '0');

    // Wave management
    private formationDirection: number = 1;
    private formationSpeed: number = 20;
    private formationDropDistance: number = 5;

    // Audio context
    private audioContext: AudioContext | null = null;

    // Constants
    private readonly SCREEN_WIDTH: number = 40;
    private readonly SCREEN_HEIGHT: number = 60;
    private readonly PLAYER_Y: number = -28;
    private readonly ENEMY_ROW_COUNT: number = 5;
    private readonly ENEMY_COL_COUNT: number = 11;
    private readonly ENEMY_SPACING_X: number = 4;
    private readonly ENEMY_SPACING_Y: number = 3;

    constructor() {
        super();

        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 30;

        // Renderer with PBR support
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.getElementById('game-container')!.appendChild(this.renderer.domElement);

        // Post-processing stack
        this.composer = new EffectComposer(this.renderer);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,
            0.4,
            0.15
        );
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(bloomPass);

        // Initialize systems
        this.input = new InputManager();
        this.collision = new CollisionSystem();
        this.scoreSystem = new ScoreSystem();
        this.memory = new MemoryManager();
        
        this.vfx = {
            particles: new ParticleSystem(this.scene, 500),
            shake: new CameraShake(),
            hitStop: new HitStop(),
            trails: new MotionTrails(),
            shockwaves: new ShockwaveRings(this.scene),
            floatingText: new FloatingText()
        };

        // Initialize pools
        this.enemyPool = new ObjectPool(() => {
            const enemy = new Enemy(
                this,
                new THREE.Vector3(0, 0, 0)
            );
            return enemy;
        }, 60);

        this.bulletPool = new ObjectPool(() => {
            const bullet = new Bullet(
                this,
                new THREE.Vector3(0, 0, 0)
            );
            return bullet;
        }, 50);

        this.powerupPool = new ObjectPool(() => {
            const powerup = new Powerup(this);
            return powerup;
        }, 10);

        // Setup lighting
        const ambientLight = new THREE.AmbientLight(0x404080, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);

        // Setup stars background
        this.setupStars();

        // Event listeners
        window.addEventListener('resize', () => this.onResize());
        
        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading')!.style.display = 'none';
        }, 500);

        // Start game loop
        this.lastTime = performance.now();
    }

    private setupStars(): void {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 1000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            
            // Random position in a large sphere
            positions[i3] = (Math.random() - 0.5) * 200;
            positions[i3 + 1] = (Math.random() - 0.5) * 200;
            positions[i3 + 2] = (Math.random() - 0.5) * 200;

            // Random color with slight blue tint
            const brightness = Math.random();
            colors[i3] = brightness * 0.8 + 0.2;
            colors[i3 + 1] = brightness * 0.8 + 0.2;
            colors[i3 + 2] = brightness * 1.0 + 0.5;
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const starMaterial = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(stars);
    }

    public start(): void {
        this.resetGame();
        this.gameState = 'playing';
        
        document.getElementById('main-menu')!.classList.add('hidden');
        document.getElementById('game-over')!.classList.add('hidden');
        
        // Initialize audio context on user interaction
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        this.spawnWave();
    }

    public restart(): void {
        this.start();
    }

    public showHighScore(): void {
        alert(`High Score: ${this.highScore}`);
    }

    private resetGame(): void {
        // Clear existing entities
        if (this.player) {
            this.scene.remove(this.player.mesh);
            this.player.dispose();
        }
        
        this.enemies.forEach(e => this.scene.remove(e.mesh));
        this.bullets.forEach(b => this.scene.remove(b.mesh));
        this.powerups.forEach(p => this.scene.remove(p.mesh));

        this.enemies = [];
        this.bullets = [];
        this.powerups = [];
        
        // Reset pools
        this.enemyPool.reset();
        this.bulletPool.reset();
        this.powerupPool.reset();

        // Reset game state
        this.waveNumber = 1;
        this.lives = 3;
        this.score = 0;
        this.formationDirection = 1;
        
        this.updateHUD();
    }

    private spawnWave(): void {
        // Calculate current speed (increases with difficulty)
        const difficultyMultiplier = 1 + (this.waveNumber - 1) * 0.1;
        this.formationSpeed = 20 * difficultyMultiplier;

        // Spawn enemies in grid formation
        for (let row = 0; row < this.ENEMY_ROW_COUNT; row++) {
            for (let col = 0; col < this.ENEMY_COL_COUNT; col++) {
                const position = new THREE.Vector3(
                    -15 + col * this.ENEMY_SPACING_X,
                    20 - row * this.ENEMY_SPACING_Y,
                    0
                );

                // Determine enemy type based on row and wave
                let type: EnemyType = EnemyType.GRUNT;
                if (this.waveNumber >= 3 && row === 0) {
                    type = Math.random() < 0.3 ? EnemyType.ELITE : EnemyType.GRUNT;
                } else if (this.waveNumber % 3 === 0 && row === 0 && col === 5) {
                    // Spawn boss every 3rd wave at center top
                    const boss = new Boss(this.enemyPool, position);
                    this.enemies.push(boss);
                    continue;
                }

                const enemy = this.enemyPool.get();
                if (enemy) {
                    enemy.initialize(position, type, this.waveNumber);
                    this.enemies.push(enemy);
                }
            }
        }

        this.updateHUD();
    }

    private updateFormation(deltaTime: number): void {
        const activeEnemies = this.enemies.filter(e => e.active && !e.isBoss);
        
        if (activeEnemies.length === 0) return;

        // Check edge boundaries
        let hitEdge = false;
        for (const enemy of activeEnemies) {
            if ((this.formationDirection > 0 && enemy.position.x > this.SCREEN_WIDTH / 2 - 2) ||
                (this.formationDirection < 0 && enemy.position.x < -this.SCREEN_WIDTH / 2 + 2)) {
                hitEdge = true;
                break;
            }
        }

        if (hitEdge) {
            this.formationDirection *= -1;
            
            // Drop all enemies down
            for (const enemy of activeEnemies) {
                enemy.position.y -= this.formationDropDistance;
                
                // Game over if enemies reach player line
                if (enemy.position.y < this.PLAYER_Y + 5) {
                    this.triggerGameOver();
                    return;
                }
            }

            // Increase speed slightly on each drop
            this.formationSpeed *= 1.02;
        } else {
            // Move formation horizontally
            for (const enemy of activeEnemies) {
                enemy.position.x += this.formationDirection * this.formationSpeed * deltaTime;
            }
        }
    }

    private updatePlayer(deltaTime: number): void {
        if (!this.player || !this.player.active) return;

        const moveSpeed = 30;
        let velocityX = 0;

        // Keyboard input
        if (this.input.isKeyDown('ArrowLeft') || this.input.isKeyDown('a')) {
            velocityX -= moveSpeed;
        }
        if (this.input.isKeyDown('ArrowRight') || this.input.isKeyDown('d')) {
            velocityX += moveSpeed;
        }

        // Gamepad input
        const gamepad = this.input.getGamepad();
        if (gamepad) {
            const axisValue = gamepad.axes[0];
            if (Math.abs(axisValue) > 0.15) {
                velocityX = axisValue * moveSpeed;
            }
        }

        // Apply movement with boundary constraints
        this.player.position.x += velocityX * deltaTime;
        this.player.position.x = Math.max(-this.SCREEN_WIDTH / 2 + 2, 
                                          Math.min(this.SCREEN_WIDTH / 2 - 2, 
                                                  this.player.position.x));

        // Shooting input
        if (this.input.isKeyDown('Space') || this.input.isGamepadButtonPressed(0)) {
            this.fireBullet();
        }
    }

    private fireBullet(): void {
        if (!this.player || !this.player.active) return;

        const bullet = this.bulletPool.get();
        if (bullet && bullet instanceof Bullet) {
            bullet.initialize(this.player.position.clone(), -200, 'player');
            this.bullets.push(bullet);
            
            // Play shoot sound
            this.playShootSound();
        }
    }

    private updateBullets(deltaTime: number): void {
        for (const bullet of this.bullets) {
            if (!bullet.active) continue;

            bullet.position.y += bullet.velocity.y * deltaTime;

            // Remove bullets off screen
            if (bullet.position.y < -30 || bullet.position.y > 30) {
                bullet.deactivate();
            }
        }

        // Cleanup inactive bullets from array
        this.bullets = this.bullets.filter(b => b.active);
    }

    private updateEnemies(deltaTime: number): void {
        for (const enemy of this.enemies) {
            if (!enemy.active) continue;

            enemy.update(deltaTime);

            // Enemy shooting logic
            if (Math.random() < 0.01 * this.waveNumber && !enemy.isBoss) {
                const bullet = this.bulletPool.get();
                if (bullet && bullet instanceof Bullet) {
                    bullet.initialize(enemy.position.clone(), -150, 'enemy');
                    this.bullets.push(bullet);
                }
            }

            // Boss shooting handled in Boss class
        }
    }

    private checkCollisions(): void {
        const activeBullets = this.bullets.filter(b => b.active);
        const activeEnemies = this.enemies.filter(e => e.active && !e.isBoss);
        
        // Bullet vs Enemy collisions
        for (const bullet of activeBullets) {
            if (!bullet.active || bullet.ownerType !== 'player') continue;

            for (const enemy of activeEnemies) {
                if (!enemy.active) continue;

                const bulletBox = new THREE.Box3().setFromObject(bullet.mesh);
                const enemyBox = new THREE.Box3().setFromObject(enemy.mesh);

                if (bulletBox.intersectsBox(enemyBox)) {
                    // Hit enemy
                    bullet.deactivate();
                    this.damageEnemy(enemy, 10);
                    
                    // Particle effect
                    this.vfx.particles.spawnExplosion(
                        bullet.position.clone(),
                        5,
                        new THREE.Color('#ff0')
                    );

                    break;
                }
            }
        }

        // Bullet vs Boss collision
        const boss = this.enemies.find(e => e.isBoss);
        if (boss && boss.active) {
            for (const bullet of activeBullets) {
                if (!bullet.active || bullet.ownerType !== 'player') continue;

                const bulletBox = new THREE.Box3().setFromObject(bullet.mesh);
                const bossBox = new THREE.Box3().setFromObject(boss.mesh);

                if (bulletBox.intersectsBox(bossBox)) {
                    bullet.deactivate();
                    this.damageEnemy(boss, 10);
                    
                    this.vfx.particles.spawnExplosion(
                        bullet.position.clone(),
                        5,
                        new THREE.Color('#ffd700')
                    );

                    break;
                }
            }
        }

        // Enemy Bullet vs Player collision
        const playerBullet = activeBullets.find(b => b.active && b.ownerType === 'enemy');
        if (playerBullet && this.player?.active) {
            const bulletBox = new THREE.Box3().setFromObject(playerBullet.mesh);
            const playerBox = new THREE.Box3().setFromObject(this.player.mesh);

            if (bulletBox.intersectsBox(playerBox)) {
                playerBullet.deactivate();
                this.damagePlayer(10);
            }
        }

        // Enemy vs Player collision (crash)
        for (const enemy of activeEnemies) {
            if (!enemy.active) continue;

            const enemyBox = new THREE.Box3().setFromObject(enemy.mesh);
            const playerBox = new THREE.Box3().setFromObject(this.player!.mesh);

            if (enemyBox.intersectsBox(playerBox)) {
                this.damagePlayer(20);
                enemy.deactivate();
                
                this.vfx.particles.spawnExplosion(
                    enemy.position.clone(),
                    15,
                    new THREE.Color('#f00')
                );
            }
        }

        // Powerup collection
        for (const powerup of this.powerups) {
            if (!powerup.active) continue;

            const powerupBox = new THREE.Box3().setFromObject(powerup.mesh);
            const playerBox = new THREE.Box3().setFromObject(this.player!.mesh);

            if (powerupBox.intersectsBox(playerBox)) {
                this.activatePowerup(powerup.type);
                powerup.deactivate();
            }
        }
    }

    private damageEnemy(enemy: Enemy, damage: number): void {
        enemy.health -= damage;
        
        // Score calculation based on enemy type
        const baseScore = enemy.scoreValue;
        this.score += baseScore;
        
        // Combo system
        if (this.scoreSystem.comboTimer > 0) {
            this.scoreSystem.comboCount++;
            this.scoreSystem.comboMultiplier = Math.min(5, 1 + this.scoreSystem.comboCount * 0.2);
        } else {
            this.scoreSystem.comboCount = 1;
            this.scoreSystem.comboMultiplier = 1;
        }
        
        this.scoreSystem.comboTimer = 3.0; // 3 second combo window
        
        const finalScore = Math.floor(baseScore * this.scoreSystem.comboMultiplier);
        this.scoreSystem.update(finalScore, enemy.position.clone());

        if (enemy.health <= 0) {
            this.killEnemy(enemy);
        }
    }

    private killEnemy(enemy: Enemy): void {
        enemy.deactivate();
        
        // Explosion effect
        this.vfx.particles.spawnExplosion(
            enemy.position.clone(),
            15,
            new THREE.Color(enemy.type === EnemyType.BOSS ? '#ffd700' : 
                          enemy.type === EnemyType.ELITE ? '#f0f' : '#0f0')
        );

        // Shockwave on boss death
        if (enemy.isBoss) {
            this.vfx.shockwaves.spawn(enemy.position.clone(), 3);
            this.vfx.hitStop.trigger(0.2);
        } else {
            // Chance to drop powerup
            if (Math.random() < 0.05) {
                const powerup = this.powerupPool.get();
                if (powerup) {
                    powerup.initialize(enemy.position.clone());
                    this.powerups.push(powerup);
                }
            }
        }

        // Check wave completion
        const remainingEnemies = this.enemies.filter(e => e.active && !e.isBoss).length;
        const bossAlive = this.enemies.some(e => e.isBoss && e.active);
        
        if (remainingEnemies === 0 && !bossAlive) {
            this.completeWave();
        }
    }

    private damagePlayer(damage: number): void {
        if (!this.player || !this.player.active) return;

        this.lives -= Math.floor(damage / 10);
        
        // Camera shake and hit stop
        this.vfx.shake.trigger(2.0);
        this.vfx.hitStop.trigger(0.3);
        
        // Explosion effect at player position
        this.vfx.particles.spawnExplosion(
            this.player.position.clone(),
            20,
            new THREE.Color('#f00')
        );

        if (this.lives <= 0) {
            this.triggerGameOver();
        } else {
            // Respawn player with invulnerability
            this.player.respawn();
            this.updateHUD();
        }
    }

    private activatePowerup(type: PowerupType): void {
        const indicator = document.getElementById('powerup-indicator')!;
        
        switch (type) {
            case PowerupType.SPREAD_SHOT:
                this.player!.activateSpreadShot(10);
                indicator.textContent = 'SPREAD SHOT';
                break;
            case PowerupType.RAPID_FIRE:
                this.player!.activateRapidFire(8);
                indicator.textContent = 'RAPID FIRE';
                break;
            case PowerupType.EXTRA_LIFE:
                this.lives = Math.min(5, this.lives + 1);
                indicator.textContent = '+1 LIFE';
                break;
            case PowerupType.SHIELD_BOOST:
                // Shield regeneration handled in Player class
                indicator.textContent = 'SHIELD BOOST';
                break;
        }

        indicator.classList.add('active');
        setTimeout(() => {
            indicator.classList.remove('active');
        }, 2000);

        this.playPowerupSound();
    }

    private completeWave(): void {
        // Clear remaining enemies
        for (const enemy of this.enemies) {
            if (enemy.active) {
                enemy.deactivate();
                this.vfx.particles.spawnExplosion(
                    enemy.position.clone(),
                    10,
                    new THREE.Color('#0ff')
                );
            }
        }

        // Bonus score for wave completion
        const bonus = this.waveNumber * 100;
        this.scoreSystem.update(bonus, new THREE.Vector3(0, 10, 0));

        // Increase wave number
        this.waveNumber++;

        if (this.waveNumber > 10) {
            // Victory condition
            this.triggerVictory();
        } else {
            // Spawn next wave after delay
            setTimeout(() => {
                this.spawnWave();
            }, 3000);
        }
    }

    private triggerGameOver(): void {
        this.gameState = 'gameover';
        
        if (this.score > this.highScore) {
            this.highScore = Math.floor(this.score);
            localStorage.setItem('spaceInvadersHighScore', this.highScore.toString());
        }

        document.getElementById('final-score')!.textContent = Math.floor(this.score).toString();
        document.getElementById('game-over')!.classList.remove('hidden');
        
        // Massive explosion at player position
        if (this.player) {
            this.vfx.particles.spawnExplosion(
                this.player.position.clone(),
                50,
                new THREE.Color('#f00')
            );
        }

        this.updateHUD();
    }

    private triggerVictory(): void {
        this.gameState = 'victory';
        
        // Victory celebration
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const position = new THREE.Vector3(
                    (Math.random() - 0.5) * 40,
                    (Math.random() - 0.5) * 20,
                    0
                );
                this.vfx.particles.spawnExplosion(position, 30, new THREE.Color('#ffd700'));
            }, i * 500);
        }

        setTimeout(() => {
            document.getElementById('game-over')!.classList.remove('hidden');
            document.querySelector('.gameover-text')!.textContent = 'VICTORY!';
            document.querySelector('.final-score')!.innerHTML = `Final Score: ${Math.floor(this.score)}`;
        }, 5000);
    }

    private updateHUD(): void {
        document.getElementById('score-display')!.textContent = Math.floor(this.score).toString();
        document.getElementById('high-score-display')!.textContent = this.highScore.toString();
        document.getElementById('wave-display')!.textContent = this.waveNumber.toString();
        document.getElementById('lives-display')!.textContent = this.lives.toString();

        // Update combo counter
        const comboCounter = document.getElementById('combo-counter')!;
        if (this.scoreSystem.comboCount > 1) {
            comboCounter.textContent = `x${this.scoreSystem.comboMultiplier.toFixed(1)}`;
            comboCounter.classList.add('active');
        } else {
            comboCounter.classList.remove('active');
        }
    }

    private playShootSound(): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    private playPowerupSound(): void {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        
        // Arpeggiated sequence
        [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, now + i * 0.1);

            gainNode.gain.setValueAtTime(0.2, now + i * 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);

            oscillator.start(now + i * 0.1);
            oscillator.stop(now + i * 0.1 + 0.3);
        });
    }

    private onResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    public update(deltaTime: number): void {
        if (this.gameState !== 'playing') return;

        // Update systems
        this.updatePlayer(deltaTime);
        this.updateBullets(deltaTime);
        this.updateEnemies(deltaTime);
        this.updateFormation(deltaTime);
        
        // Check collisions
        this.checkCollisions();

        // Update VFX systems
        this.vfx.particles.update(deltaTime);
        this.vfx.shake.update(deltaTime, this.camera.position);
        this.vfx.hitStop.update(deltaTime);
        this.vfx.trails.update(deltaTime);
        this.vfx.shockwaves.update(deltaTime);
        this.vfx.floatingText.update(deltaTime);

        // Update combo timer
        if (this.scoreSystem.comboTimer > 0) {
            this.scoreSystem.comboTimer -= deltaTime;
            if (this.scoreSystem.comboTimer <= 0) {
                this.scoreSystem.comboCount = 0;
                this.scoreSystem.comboMultiplier = 1;
            }
        }

        // Update powerups
        for (const powerup of this.powerups) {
            if (powerup.active) {
                powerup.update(deltaTime);
            }
        }
        this.powerups = this.powerups.filter(p => p.active);
    }

    public render(): void {
        // Apply camera shake
        const shakeOffset = this.vfx.shake.getShakeOffset();
        this.camera.position.x += shakeOffset.x;
        this.camera.position.y += shakeOffset.y;

        // Render scene with post-processing
        this.composer.render();

        // Reset camera position
        this.camera.position.x -= shakeOffset.x;
        this.camera.position.y -= shakeOffset.y;
    }

    public dispose(): void {
        // Dispose all Three.js resources
        this.memory.disposeGame();
        
        if (this.player) {
            this.scene.remove(this.player.mesh);
            this.player.dispose();
        }

        this.enemies.forEach(e => {
            this.scene.remove(e.mesh);
            e.dispose();
        });

        this.bullets.forEach(b => {
            this.scene.remove(b.mesh);
            b.dispose();
        });

        this.powerups.forEach(p => {
            this.scene.remove(p.mesh);
            p.dispose();
        });

        // Dispose post-processing
        this.composer.dispose();
        this.renderer.dispose();

        window.removeEventListener('resize', () => this.onResize());
    }
}