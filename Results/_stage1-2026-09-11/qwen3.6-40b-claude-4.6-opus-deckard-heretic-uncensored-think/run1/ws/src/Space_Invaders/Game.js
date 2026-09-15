/**
 * Core Game Logic - Space Invaders gameplay mechanics
 */
import PlayerShip from './entities/PlayerShip';
import Enemy from './entities/Enemy';
import Projectile from './entities/Projectile';

class Game {
    constructor(scene, inputManager) {
        this.scene = scene;
        this.inputManager = inputManager;
        
        // Game state
        this.state = 'menu'; // menu, playing, paused, gameover
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        
        // Entities
        this.player = null;
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        
        // Camera shake system
        this.cameraShakeSystem = new CameraShakeSystem(scene.camera);
        
        // Initialize game objects
        this._initializeGame();
    }

    _initializeGame() {
        // Create player ship at bottom of screen
        this.player = new PlayerShip(0, -15, 30);
        
        // Spawn initial enemy formation
        this._spawnEnemies();
    }

    _spawnEnemies() {
        const rows = 5;
        const cols = 8;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = -15 + col * 4;
                const y = 20 + row * 3;
                
                this.enemies.push(new Enemy(x, y));
            }
        }
    }

    update(deltaTime) {
        switch(this.state) {
            case 'menu':
                this._updateMenu();
                break;
            case 'playing':
                this._updateGameplay(deltaTime);
                break;
            case 'paused':
                // Pause state - no updates
                break;
            case 'gameover':
                this._updateGameOver();
                break;
        }
    }

    _updateMenu() {
        if (this.inputManager.isActionActive('start')) {
            this.state = 'playing';
            this._initializeGame();
        }
    }

    _updateGameplay(deltaTime) {
        // Update player ship
        this.player.update(this.inputManager, deltaTime);
        
        // Update enemies and their projectiles
        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            enemy.update(deltaTime);
            
            // Check if enemy reached bottom
            if (enemy.position.y > -15) {
                this.lives--;
                
                // Trigger camera shake for impact
                this.cameraShakeSystem.triggerShake(0.5, 0.3);
                
                // Create explosion effect
                const explosion = new ExplosionBurst(this.particles, enemy.position);
                this.particles.push(explosion);
            }
        }
        
        // Update projectiles and check collisions
        for (let i = 0; i < this.projectiles.length; i++) {
            const projectile = this.projectiles[i];
            
            if (!projectile.update(deltaTime)) {
                continue;
            }
            
            // Check collision with enemies
            for (let j = 0; j < this.enemies.length; j++) {
                const enemy = this.enemies[j];
                
                if (PhysicsUtils.checkCircle(projectile, enemy)) {
                    // Enemy hit - create explosion and add score
                    const explosion = new ExplosionBurst(this.particles, enemy.position);
                    this.particles.push(explosion);
                    
                    this.score += 10;
                    
                    // Trigger camera shake for impact
                    this.cameraShakeSystem.triggerShake(0.3, 0.2);
                    
                    // Remove projectile and enemy
                    this.projectiles.splice(i, 1);
                    this.enemies.splice(j, 1);
                    
                    i--; j = -1;
                }
            }
        }
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            if (!particle.update(deltaTime)) {
                this.particles.splice(i, 1);
            }
        }
        
        // Check win condition (all enemies destroyed)
        if (this.enemies.length === 0) {
            this.level++;
            this._spawnEnemies();
        }
        
        // Check game over condition
        if (this.lives <= 0) {
            this.state = 'gameover';
        }
    }

    _updateGameOver() {
        if (this.inputManager.isActionActive('start')) {
            this._resetGame();
        }
    }

    _resetGame() {
        // Reset game state and entities
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        
        // Clear all enemies and projectiles
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        
        // Reinitialize game objects
        this._initializeGame();
        
        this.state = 'playing';
    }

    destroy() {
        // Dispose of resources
        if (this.player) {
            this.player.dispose();
        }
        
        for (let i = 0; i < this.enemies.length; i++) {
            this.enemies[i].dispose();
        }
        
        for (let i = 0; i < this.projectiles.length; i++) {
            this.projectiles[i].dispose();
        }
        
        // Clear references
        this.player = null;
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
    }
}

export default Game;
