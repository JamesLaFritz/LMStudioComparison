import * as THREE from 'three';
import { Engine } from '../../shared/Engine';
import { Input } from '../../shared/Input';
import { AABBOverlap } from '../../shared/Physics';
import { TextureGenerator, AlienType, ALIEN_COLORS } from './assets/TextureGenerator';
import { AudioSynth } from './assets/AudioSynth';
import { Player } from './entities/Player';
import { Alien } from './entities/Alien';
import { Projectile } from './entities/Projectile';
import { MysteryShip } from './entities/MysteryShip';
import { ShieldBlock } from './entities/ShieldBlock';
import { ProjectilePool } from './components/ProjectilePool';
import { ParticleBurstComponent } from './components/ParticleBurstComponent';
import { ScoreComponent, GameState } from './components/ScoreComponent';
import { HUD } from './ui/HUD';
import { SpaceInvadersVFX } from './vfx/SpaceInvadersVFX';

export class SpaceInvadersScene {
    private engine: Engine;
    private input: Input;
    private textureGenerator: TextureGenerator;
    private audioSynth: AudioSynth;
    private hud: HUD;
    private vfx: SpaceInvadersVFX;
    private scoreComponent: ScoreComponent;
    private projectilePool: ProjectilePool;
    private particleBurstComponent: ParticleBurstComponent;

    private player!: Player;
    private aliens: Alien[] = [];
    private projectiles: Projectile[] = [];
    private mysteryShip: MysteryShip | null = null;
    private shieldBlocks: ShieldBlock[] = [];
    private starFieldPoints!: THREE.Points;

    // Formation state
    private formationDirection: number = 1;
    private formationX: number = 0;
    private formationY: number = 0;
    private formationSpeed: number = 0.4;
    private lastFormationMoveTime: number = 0;
    private alienMoveInterval: number = 1.0;

    // Shooting state
    private lastAlienShootTime: number = 0;
    private alienShootInterval: number = 1.0;

    // Mystery ship state
    private lastMysteryShipTime: number = 0;
    private nextMysteryShipTime: number = 0;

    // Camera zoom animation
    private cameraZoomActive: boolean = false;
    private cameraZoomStartTime: number = 0;
    private cameraZoomDuration: number = 1.5;
    private originalOrthoScale: number = 1.0;
    private zoomedOrthoScale: number = 0.85;

    // Animation state
    private alienAnimFrame: number = 0;
    private lastAlienAnimTime: number = 0;

    // Boundary constants
    private boundaryLeft: number = -14;
    private boundaryRight: number = 14;
    private playerY: number = -5.5;
    private formationStartX: number = 0;
    private formationStartY: number = 2.5;

    constructor(engine: Engine, input: Input) {
        this.engine = engine;
        this.input = input;
        this.textureGenerator = new TextureGenerator();
        this.audioSynth = new AudioSynth();
        this.hud = new HUD();
        this.vfx = new SpaceInvadersVFX(this.engine);
        this.scoreComponent = new ScoreComponent();
        this.projectilePool = new ProjectilePool(200, this.engine.scene);
        this.particleBurstComponent = new ParticleBurstComponent(this.engine, this.textureGenerator);

        this.hud.init();
    }

    init(): void {
        // Create starfield background
        this.createStarField();

        // Initialize player
        this.player = new Player(
            this.engine.scene,
            this.boundaryLeft,
            this.boundaryRight,
            this.playerY,
            6.0,
            this.textureGenerator,
            this.audioSynth
        );

        // Start music
        this.audioSynth.startMusic();

        // Start first wave
        this.startWave(1);

        // Update HUD
        this.hud.updateScore(0);
        this.hud.updateLives(3);
        this.hud.updateWave(1);
    }

    private createStarField(): void {
        const starCount = 2000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const x = (Math.random() - 0.5) * 60;
            const y = (Math.random() - 0.5) * 40;
            const z = -(20 + Math.random() * 40);

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Slight color variation (white to pale blue)
            const brightness = 0.5 + Math.random() * 0.5;
            colors[i * 3] = brightness * 0.9;
            colors[i * 3 + 1] = brightness * 0.92;
            colors[i * 3 + 2] = brightness;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true,
        });

        this.starFieldPoints = new THREE.Points(geometry, material);
        this.engine.scene.add(this.starFieldPoints);
    }

    startWave(waveNumber: number): void {
        // Clear existing aliens and projectiles
        for (const alien of this.aliens) {
            alien.dispose();
        }
        this.aliens = [];

        for (const proj of this.projectiles) {
            proj.dispose();
        }
        this.projectiles = [];

        if (this.mysteryShip) {
            this.mysteryShip.dispose();
            this.mysteryShip = null;
        }

        // Reset formation position
        this.formationX = 0;
        this.formationY = 2.5;
        this.formationDirection = 1;

        // Calculate difficulty-based speed
        const baseSpeed = 0.4 * (1 + (waveNumber - 1) * 0.25);
        this.alienMoveInterval = Math.max(0.1, 1.0 / (1 + (waveNumber - 1) * 0.3));

        // Spawn alien grid: 5 rows x 11 columns
        const rows = 5;
        const cols = 11;
        const cellWidth = 3.0;
        const cellHeight = 2.5;
        const spacing = 0.8;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const alienType: AlienType = row as AlienType; // Top row is type 0, etc.
                const x = (col - (cols - 1) / 2) * (cellWidth + spacing);
                const y = this.formationStartY - row * cellHeight;

                const alien = new Alien(
                    this.engine.scene,
                    alienType,
                    x, y, 0,
                    this.textureGenerator
                );
                this.aliens.push(alien);
            }
        }

        // Spawn shields (only on wave 1 or if all shields destroyed)
        if (this.shieldBlocks.length === 0 || this.shieldBlocks.every(b => b.isDestroyed)) {
            this.spawnShields();
        }

        // Camera zoom animation for wave start
        this.cameraZoomActive = true;
        this.cameraZoomStartTime = this.engine.elapsedTime;
    }

    private spawnShields(): void {
        const shieldCount = 4;
        const shieldSpacing = 7.0;
        const blocksPerShieldX = 8;
        const blocksPerShieldY = 5;
        const blockSize = 0.6;
        const blockGap = 0.1;

        for (let s = 0; s < shieldCount; s++) {
            const shieldCenterX = -((shieldCount - 1) * shieldSpacing) / 2 + s * shieldSpacing;
            const shieldY = -1.5;

            for (let row = 0; row < blocksPerShieldY; row++) {
                for (let col = 0; col < blocksPerShieldX; col++) {
                    // Create arch shape by removing bottom-center blocks
                    if (row === 0 && col >= 3 && col <= 4) continue;

                    const x = shieldCenterX + (col - (blocksPerShieldX - 1) / 2) * (blockSize + blockGap);
                    const y = shieldY + row * (blockSize + blockGap);

                    const block = new ShieldBlock(
                        this.engine.scene,
                        x, y, 0,
                        blockSize, blockSize
                    );
                    this.shieldBlocks.push(block);
                }
            }
        }
    }

    update(deltaTime: number): void {
        if (this.scoreComponent.gameState !== GameState.PLAYING) return;

        const now = this.engine.elapsedTime;

        // Update camera zoom animation
        this.updateCameraZoom(now, deltaTime);

        // Update starfield drift
        this.updateStarField(deltaTime);

        // Player movement
        const inputDir = this.input.getDirection();
        this.player.move(inputDir.x * deltaTime);

        // Player shooting
        if (this.input.isActionJustPressed('shoot')) {
            this.attemptPlayerShoot();
        }

        // Formation movement
        this.updateFormation(now, deltaTime);

        // Alien shooting
        this.updateAlienShooting(now, deltaTime);

        // Update projectiles
        this.updateProjectiles(deltaTime);

        // Mystery ship logic
        this.updateMysteryShip(now, deltaTime);

        // Check win condition (all aliens dead)
        if (this.aliens.length === 0) {
            const nextWave = this.scoreComponent.wave + 1;
            this.scoreComponent.setWave(nextWave);
            this.hud.updateWave(nextWave);
            this.startWave(nextWave);
        }

        // Check loss condition (formation reached player level)
        if (this.aliens.length > 0) {
            const lowestAlien = Math.max(...this.aliens.map(a => a.mesh.position.y));
            if (lowestAlien >= this.playerY + 1.5) {
                this.scoreComponent.loseLife();
                this.hud.updateLives(this.scoreComponent.lives);

                if (this.scoreComponent.lives <= 0) {
                    this.handlePlayerDeath();
                } else {
                    // Reset player position and continue
                    this.player.resetPosition();
                }
            }
        }

        // Update combo timer
        this.scoreComponent.updateCombo(deltaTime);

        // Mystery ship periodic check
        if (now >= this.nextMysteryShipTime && !this.mysteryShip) {
            this.spawnMysteryShip();
        }
    }

    private updateCameraZoom(now: number, deltaTime: number): void {
        if (!this.cameraZoomActive) return;

        const elapsed = now - this.cameraZoomStartTime;
        const progress = Math.min(elapsed / this.cameraZoomDuration, 1.0);

        // Ease in-out quad
        const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        if (this.engine.camera.isOrthographicCamera && this.engine.camera.zoom !== undefined) {
            // Zoom in first, then pull back
            const zoomInPhase = Math.min(progress / 0.3, 1.0);
            const currentZoom = 1.0 + (1.0 / this.zoomedOrthoScale - 1.0) * zoomInPhase;
            this.engine.camera.zoom = currentZoom;
            this.engine.camera.updateProjectionMatrix();

            if (progress >= 1.0) {
                this.cameraZoomActive = false;
                // Reset to normal
                setTimeout(() => {
                    if (this.engine.camera.isOrthographicCamera && this.engine.camera.zoom !== undefined) {
                        this.engine.camera.zoom = 1.0;
                        this.engine.camera.updateProjectionMatrix();
                    }
                }, 200);
            }
        }
    }

    private updateStarField(deltaTime: number): void {
        if (!this.starFieldPoints) return;
        const positions = (this.starFieldPoints.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += deltaTime * (0.5 + Math.random() * 0.1);
            // Wrap around
            if (positions[i + 1] > 20) {
                positions[i + 1] = -20;
            }
        }
        this.starFieldPoints.geometry.attributes.position.needsUpdate = true;
    }

    private updateFormation(now: number, deltaTime: number): void {
        if (this.aliens.length === 0) return;

        // Calculate dynamic speed based on remaining aliens
        const totalAliens = 55; // 5 rows x 11 cols
        const remainingRatio = this.aliens.length / totalAliens;
        const waveMultiplier = 1 + (this.scoreComponent.wave - 1) * 0.25;
        const currentSpeed = this.formationSpeed * waveMultiplier * (1 + remainingRatio * 0.5);

        // Move interval decreases with fewer aliens and higher waves
        const moveInterval = Math.max(0.05, this.alienMoveInterval / (1 + remainingRatio * 2));

        if (now - this.lastFormationMoveTime < moveInterval) return;

        this.lastFormationMoveTime = now;

        // Move formation horizontally
        this.formationX += this.formationDirection * currentSpeed * deltaTime * 3;

        // Clamp and bounce at edges
        const maxExtent = (11 - 1) / 2 * 3.0 + 1.5; // half-width of formation
        if (this.formationX > maxExtent || this.formationX < -maxExtent) {
            this.formationDirection *= -1;
            this.formationY -= 0.4; // Drop down
        }

        // Update each alien position with eased interpolation
        for (const alien of this.aliens) {
            const targetX = alien.initialX + this.formationX;
            const targetY = alien.initialY + this.formationY;

            // Smooth interpolation (ease-in-out)
            const easeFactor = 1 - Math.pow(0.95, deltaTime * 10);
            alien.mesh.position.x += (targetX - alien.mesh.position.x) * easeFactor;
            alien.mesh.position.y += (targetY - alien.mesh.position.y) * easeFactor;

            // Animation frame toggle
            if (now - this.lastAlienAnimTime > 0.8) {
                this.alienAnimFrame = this.alienAnimFrame === 0 ? 1 : 0;
                this.lastAlienAnimTime = now;
            }
            alien.setFrame(this.alienAnimFrame);
        }
    }

    private updateAlienShooting(now: number, deltaTime: number): void {
        if (this.aliens.length === 0) return;

        const shootInterval = Math.max(0.3, 1.0 / (1 + this.scoreComponent.wave * 0.3));
        if (now - this.lastAlienShootTime < shootInterval) return;

        // Find bottom-most alien in each column
        const columns = new Map<number, Alien>();
        for (const alien of this.aliens) {
            const colIndex = Math.round(alien.initialX / 3.8);
            const existing = columns.get(colIndex);
            if (!existing || alien.initialY < existing.initialY) {
                columns.set(colIndex, alien);
            }
        }

        // Pick random shooter from bottom aliens
        const bottomAliens = Array.from(columns.values());
        if (bottomAliens.length === 0) return;

        const shooter = bottomAliens[Math.floor(Math.random() * bottomAliens.length)];

        // Fire projectile downward with slight horizontal spread
        const proj = this.projectilePool.acquire('alien');
        proj.mesh.position.copy(shooter.mesh.position);
        proj.velocity.set(
            (Math.random() - 0.5) * 1.0,
            -6.0,
            0
        );
        proj.owner = 'alien';

        this.lastAlienShootTime = now;
    }

    private attemptPlayerShoot(): void {
        // Check if player already has a projectile active (classic constraint)
        const existingPlayerProj = this.projectiles.find(
            p => p.owner === 'player' && !p.isDestroyed
        );
        if (existingPlayerProj) return;

        const proj = this.projectilePool.acquire('player');
        proj.mesh.position.copy(this.player.mesh.position);
        proj.mesh.position.y += 1.0; // Start from top of ship
        proj.velocity.set(0, 12.0, 0);
        proj.owner = 'player';

        this.audioSynth.playShoot();
    }

    private updateProjectiles(deltaTime: number): void {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            if (proj.isDestroyed) continue;

            // Move projectile
            proj.mesh.position.x += proj.velocity.x * deltaTime;
            proj.mesh.position.y += proj.velocity.y * deltaTime;

            // Remove if off-screen
            if (proj.mesh.position.y > 10 || proj.mesh.position.y < -10 ||
                Math.abs(proj.mesh.position.x) > 20) {
                this.projectilePool.release(proj);
                proj.isDestroyed = true;
                this.projectiles.splice(i, 1);
                continue;
            }

            // Collision detection
            if (proj.owner === 'player') {
                this.checkPlayerProjectileCollision(proj, i);
            } else {
                this.checkAlienProjectileCollision(proj, i);
            }

            // Check shield collision for all projectiles
            this.checkShieldCollision(proj, i);
        }
    }

    private checkPlayerProjectileCollision(proj: Projectile, projIndex: number): void {
        // Check mystery ship first
        if (this.mysteryShip && !this.mysteryShip.isDestroyed) {
            const dist = proj.mesh.position.distanceTo(this.mysteryShip.mesh.position);
            if (dist < 1.5) {
                const points = [100, 200, 300][Math.floor(Math.random() * 3)];
                this.scoreComponent.addScore(points, -1); // Special row
                this.hud.updateScore(this.scoreComponent.score);

                this.vfx.onAlienKill(null, this.mysteryShip.mesh.position.clone(), points);
                this.audioSynth.playSaucerHit();

                this.mysteryShip.dispose();
                this.mysteryShip = null;

                this.projectilePool.release(proj);
                proj.isDestroyed = true;
                this.projectiles.splice(projIndex, 1);
                return;
            }
        }

        // Check alien collisions
        for (let j = this.aliens.length - 1; j >= 0; j--) {
            const alien = this.aliens[j];
            if (alien.isDestroyed) continue;

            const distX = Math.abs(proj.mesh.position.x - alien.mesh.position.x);
            const distY = Math.abs(proj.mesh.position.y - alien.mesh.position.y);

            if (distX < 1.2 && distY < 1.0) {
                // Hit!
                const points = this.getAlienPoints(alien.type);
                this.scoreComponent.addScore(points, alien.type);
                this.hud.updateScore(this.scoreComponent.score);

                this.vfx.onAlienKill(alien, alien.mesh.position.clone(), points);
                this.audioSynth.playAlienKill();

                // Remove alien
                alien.dispose();
                this.aliens.splice(j, 1);

                this.projectilePool.release(proj);
                proj.isDestroyed = true;
                this.projectiles.splice(projIndex, 1);
                return;
            }
        }
    }

    private checkAlienProjectileCollision(proj: Projectile, projIndex: number): void {
        // Check player collision
        const distX = Math.abs(proj.mesh.position.x - this.player.mesh.position.x);
        const distY = Math.abs(proj.mesh.position.y - this.player.mesh.position.y);

        if (distX < 1.0 && distY < 0.8) {
            this.scoreComponent.loseLife();
            this.hud.updateLives(this.scoreComponent.lives);

            this.vfx.onPlayerDeath();
            this.audioSynth.playPlayerDeath();

            // Brief invincibility or reset position
            if (this.scoreComponent.lives <= 0) {
                this.handlePlayerDeath();
            } else {
                this.player.resetPosition();
            }

            this.projectilePool.release(proj);
            proj.isDestroyed = true;
            this.projectiles.splice(projIndex, 1);
            return;
        }
    }

    private checkShieldCollision(proj: Projectile, projIndex: number): void {
        for (let i = this.shieldBlocks.length - 1; i >= 0; i--) {
            const block = this.shieldBlocks[i];
            if (block.isDestroyed) continue;

            const distX = Math.abs(proj.mesh.position.x - block.mesh.position.x);
            const distY = Math.abs(proj.mesh.position.y - block.mesh.position.y);

            if (distX < 0.4 && distY < 0.4) {
                // Destroy block
                this.particleBurstComponent.onShieldHit(block.mesh.position.clone(), ALIEN_COLORS[block.alienType]);
                this.audioSynth.playShieldHit();

                block.destroy();
                this.shieldBlocks.splice(i, 1);

                // Remove projectile (both player and alien)
                this.projectilePool.release(proj);
                proj.isDestroyed = true;
                this.projectiles.splice(projIndex, 1);
                return;
            }
        }
    }

    private getAlienPoints(type: AlienType): number {
        switch (type) {
            case 0: return 50; // Top row - squid
            case 1:
            case 2: return 40; // Middle rows - crab/octopus
            case 3:
            case 4: return 30; // Bottom rows
        }
        return 30;
    }

    private updateMysteryShip(now: number, deltaTime: number): void {
        if (!this.mysteryShip || this.mysteryShip.isDestroyed) return;

        this.mysteryShip.update(deltaTime);

        // Remove if off-screen
        if (Math.abs(this.mysteryShip.mesh.position.x) > 20) {
            this.mysteryShip.dispose();
            this.mysteryShip = null;
        }
    }

    private spawnMysteryShip(): void {
        const direction = Math.random() < 0.5 ? 1 : -1;
        this.mysteryShip = new MysteryShip(
            this.engine.scene,
            direction,
            7.0 // Top of screen Y position
        );
        this.lastMysteryShipTime = this.engine.elapsedTime;
        this.nextMysteryShipTime = this.engine.elapsedTime + (15 + Math.random() * 15);
    }

    private handlePlayerDeath(): void {
        this.scoreComponent.gameState = GameState.GAME_OVER;
        this.hud.showGameOver(this.scoreComponent.score, this.scoreComponent.wave);
        this.audioSynth.stopMusic();
    }

    restart(): void {
        // Dispose all entities
        for (const alien of this.aliens) {
            alien.dispose();
        }
        this.aliens = [];

        for (const proj of this.projectiles) {
            proj.dispose();
        }
        this.projectiles = [];

        if (this.mysteryShip) {
            this.mysteryShip.dispose();
            this.mysteryShip = null;
        }

        for (const block of this.shieldBlocks) {
            block.destroy();
        }
        this.shieldBlocks = [];

        // Reset score component
        this.scoreComponent.reset();
        this.hud.updateScore(0);
        this.hud.updateLives(3);
        this.hud.updateWave(1);
        this.hud.hideGameOver();

        // Reset player
        this.player.resetPosition();

        // Restart music
        this.audioSynth.startMusic();

        // Start wave 1
        this.startWave(1);

        // Reset mystery ship timer
        this.lastMysteryShipTime = this.engine.elapsedTime;
        this.nextMysteryShipTime = this.engine.elapsedTime + (15 + Math.random() * 15);
    }

    dispose(): void {
        this.player.dispose();
        for (const alien of this.aliens) {
            alien.dispose();
        }
        for (const proj of this.projectiles) {
            proj.dispose();
        }
        if (this.mysteryShip) {
            this.mysteryShip.dispose();
        }
        for (const block of this.shieldBlocks) {
            block.destroy();
        }

        // Dispose starfield
        if (this.starFieldPoints) {
            this.starFieldPoints.geometry.dispose();
            (this.starFieldPoints.material as THREE.Material).dispose();
            this.engine.scene.remove(this.starFieldPoints);
        }

        this.audioSynth.stopMusic();
        this.hud.dispose();
    }
}
