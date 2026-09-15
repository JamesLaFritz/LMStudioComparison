import { GameState } from './gameState.js';
import { ScoreSystem } from './scoreSystem.js';
import { Player } from '../entities/player.js';
import { EnemyManager } from '../entities/enemy.js';
import { ProjectileManager } from '../entities/projectile.js';
import { Environment } from '../entities/environment.js';
import { RenderSystem } from '../systems/renderSystem.js';
import { PhysicsSystem } from '../systems/physicsSystem.js';
import { AudioSystem } from '../systems/audioSystem.js';

export class GameLoop {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
        // Initialize game systems
        this.gameState = new GameState();
        this.scoreSystem = new ScoreSystem();
        this.player = new Player(scene);
        this.enemyManager = new EnemyManager(scene, this.player.position);
        this.projectileManager = new ProjectileManager(scene);
        this.environment = new Environment(scene);
        this.renderSystem = new RenderSystem(renderer, scene, camera);
        this.physicsSystem = new PhysicsSystem();
        this.audioSystem = new AudioSystem();
        
        // Game loop state
        this.lastTime = performance.now();
        this.timeScale = 1.0;
        this.isPaused = false;
        this.gameOver = false;
        
        // Initialize systems
        this.initializeSystems();
    }
    
    initializeSystems() {
        // Start with menu state
        this.gameState.setState(GameState.State.MENU);
        
        // Initialize player
        this.player.initialize();
        
        // Initialize enemies for first wave
        this.enemyManager.createWave(1);
        
        // Setup environment
        this.environment.initialize();
        
        // Initialize render system
        this.renderSystem.initialize();
        
        // Start audio
        this.audioSystem.startBackgroundMusic();
    }
    
    update() {
        const currentTime = performance.now();
        let deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Clamp delta time to prevent physics issues
        deltaTime = Math.min(deltaTime, 0.05);
        
        if (!this.isPaused && !this.gameOver) {
            // Update game state based on current state machine
            switch (this.gameState.currentState) {
                case GameState.State.MENU:
                    this.updateMenuState();
                    break;
                case GameState.State.PLAYING:
                    this.updatePlayingState(deltaTime);
                    break;
                case GameState.State.PAUSED:
                    // Don't update gameplay, just wait for resume
                    break;
                case GameState.State.GAME_OVER:
                    this.updateGameOverState();
                    break;
            }
        }
        
        // Update render system (always runs)
        this.renderSystem.update(deltaTime);
    }
    
    updateMenuState() {
        // Handle menu input - start game on enter/space
        if (this.shouldStartGame()) {
            this.gameState.setState(GameState.State.PLAYING);
            this.audioSystem.playSound('start');
        }
        
        // Animate background elements for visual appeal
        this.environment.animateBackground(0.5);
    }
    
    updatePlayingState(deltaTime) {
        // Update player with time scale for hit-stop effects
        const scaledDeltaTime = deltaTime * this.timeScale;
        
        // Player movement and shooting
        this.player.update(scaledDeltaTime);
        
        // Update enemies
        this.enemyManager.update(scaledDeltaTime, this.player.position);
        
        // Update projectiles
        this.projectileManager.update(deltaTime, this.player.position);
        
        // Check collisions
        this.checkCollisions();
        
        // Update score system
        this.scoreSystem.update(this.enemyManager.getDestroyedEnemies());
        
        // Check win/loss conditions
        this.checkGameConditions();
        
        // Update environment effects
        this.environment.animateBackground(1.0);
    }
    
    updateGameOverState() {
        // Handle game over input - restart on enter/space
        if (this.shouldRestart()) {
            this.restartGame();
        }
        
        // Slow background animation for dramatic effect
        this.environment.animateBackground(0.2);
    }
    
    checkCollisions() {
        const playerPosition = this.player.position;
        const projectiles = this.projectileManager.getActiveProjectiles();
        const enemies = this.enemyManager.getEnemies();
        
        // Player projectile vs enemy collisions
        for (let i = 0; i < projectiles.length; i++) {
            if (!projectiles[i].isPlayerProjectile) continue;
            
            for (let j = 0; j < enemies.length; j++) {
                const enemy = enemies[j];
                
                // Check collision using physics system
                if (this.physicsSystem.checkCollision(
                    projectiles[i].position, 
                    enemy.position, 
                    this.projectileManager.getProjectileRadius(),
                    this.enemyManager.getEnemyRadius(enemy.type)
                )) {
                    // Handle collision - destroy both projectile and enemy
                    this.projectileManager.destroyProjectile(i);
                    this.enemyManager.destroyEnemy(j);
                    
                    // Add score for destroyed enemy
                    this.scoreSystem.addScore(this.enemyManager.calculateEnemyScore(enemy));
                    
                    // Trigger visual effects
                    this.triggerExplosionEffect(projectiles[i].position, enemy.type);
                    
                    i--; j--; break;
                }
            }
        }
        
        // Enemy projectile vs player collisions
        for (let i = 0; i < projectiles.length; i++) {
            if (projectiles[i].isPlayerProjectile) continue;
            
            if (this.physicsSystem.checkCollision(
                projectiles[i].position, 
                playerPosition, 
                this.projectileManager.getProjectileRadius(),
                this.player.getHitboxRadius()
            )) {
                // Player hit - lose life or game over
                this.handlePlayerHit(projectiles[i]);
                break;
            }
        }
    }
    
    handlePlayerHit(enemyProjectile) {
        const lives = this.scoreSystem.decrementLives();
        
        if (lives <= 0) {
            // Game over - no more lives
            this.gameState.setState(GameState.State.GAME_OVER);
            this.audioSystem.playSound('gameover');
            this.triggerGameOverEffect();
        } else {
            // Trigger hit effect and temporary invulnerability
            this.player.activateInvulnerability(2.0);
            this.triggerHitEffect(this.player.position);
        }
        
        // Destroy enemy projectile that hit player
        this.projectileManager.destroyProjectile(enemyProjectile.index);
    }
    
    checkGameConditions() {
        const enemies = this.enemyManager.getEnemies();
        const lives = this.scoreSystem.getLives();
        
        // Win condition - all enemies destroyed
        if (enemies.length === 0) {
            this.levelComplete();
        }
        
        // Loss condition - no lives remaining
        if (lives <= 0 && !this.gameOver) {
            this.gameState.setState(GameState.State.GAME_OVER);
            this.audioSystem.playSound('gameover');
        }
    }
    
    levelComplete() {
        const nextLevel = this.enemyManager.getCurrentWave() + 1;
        
        // Create new wave of enemies with increased difficulty
        setTimeout(() => {
            this.enemyManager.createWave(nextLevel);
            this.scoreSystem.levelUp();
            
            // Increase game speed for next level
            this.timeScale = Math.min(1.0 + (nextLevel * 0.1), 2.0);
        }, 3000);
    }
    
    triggerExplosionEffect(position, enemyType) {
        const intensity = enemyType === 'boss' ? 5 : 2;
        
        // Create particle explosion
        this.triggerScreenShake(intensity * 0.3);
        this.createParticleBurst(position, intensity);
        this.playExplosionSound(enemyType);
    }
    
    triggerHitEffect(position) {
        // Create hit effect at player position
        this.triggerScreenShake(0.5);
        this.createParticleBurst(position, 1);
        this.audioSystem.playSound('hit');
    }
    
    triggerGameOverEffect() {
        // Dramatic game over effects
        this.triggerScreenShake(2.0);
        this.timeScale = 0.1; // Slow motion effect
        
        setTimeout(() => {
            this.timeScale = 1.0;
        }, 2000);
    }
    
    triggerScreenShake(intensity) {
        this.renderSystem.triggerCameraShake(intensity);
    }
    
    createParticleBurst(position, intensity) {
        // Create particle burst at position with given intensity
        const particles = [];
        for (let i = 0; i < intensity * 20; i++) {
            particles.push({
                position: position.clone(),
                velocity: new THREE.Vector3(
                    Math.random() * -10,
                    Math.random() * 15 + 5,
                    Math.random() * -5
                ),
                life: Math.random() * 2 + 1,
                size: Math.random() * 0.5 + 0.2,
                color: new THREE.Color(
                    Math.random(), 
                    Math.random() * 0.7, 
                    0
                )
            });
        }
        
        this.environment.createParticleBurst(particles);
    }
    
    playExplosionSound(enemyType) {
        const sound = enemyType === 'boss' ? 'explosion_boss' : 'explosion';
        this.audioSystem.playSound(sound);
    }
    
    shouldStartGame() {
        // Check for start game input (enter or space)
        return false; // Placeholder - implement based on input system
    }
    
    shouldRestart() {
        // Check for restart game input
        return false; // Placeholder - implement based on input system
    }
    
    restartGame() {
        // Reset all game systems to initial state
        this.gameState.setState(GameState.State.PLAYING);
        this.player.reset();
        this.enemyManager.createWave(1);
        this.projectileManager.clearAllProjectiles();
        this.scoreSystem.reset();
        this.timeScale = 1.0;
        
        // Restart background music
        this.audioSystem.stopBackgroundMusic();
        this.audioSystem.startBackgroundMusic();
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

export default GameLoop;