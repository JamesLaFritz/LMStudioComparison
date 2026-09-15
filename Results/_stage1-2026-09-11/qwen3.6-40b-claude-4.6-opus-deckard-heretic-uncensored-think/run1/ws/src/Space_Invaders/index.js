/**
 * Space Invaders - Entry Point
 */
import { Scene as THREE_Scene, PerspectiveCamera, WebGLRenderer } from '../shared/three';
import InputManager from '../shared/input/InputManager';

class SpaceInvadersApp {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error('Container element not found');
        }
        
        // Initialize systems
        this.inputManager = new InputManager();
        this.scene = new THREE_Scene();
        this.camera = new PerspectiveCamera(60, 1.75, 0.1, 1000);
        this.renderer = new WebGLRenderer({ antialias: true });
        
        // Configure renderer
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(containerId.clientWidth, containerId.clientHeight);
        this.renderer.setClearColor(0x780820); // Dark space background
        
        // Add scene to container
        containerId.appendChild(this.renderer.domElement);
        
        // Set up camera position
        this.camera.position.set(0, 15, 30);
        this.camera.lookAt(0, 0, 0);
        
        // Initialize game state
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
        this.cameraShakeSystem = new CameraShakeSystem(this.camera);
        
        // Initialize game objects
        this._initializeGame();
        
        // Start the game loop
        this._gameLoop();
    }

    _gameLoop() {
        requestAnimationFrame(() => {
            this._update();
            this._render();
            this._gameLoop();
        });
    }

    _update() {
        const deltaTime = 1 / 60; // Fixed timestep
        
        // Update input manager
        this.inputManager.update();
        
        // Update game state based on current mode
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

    _render() {
        // Apply camera shake if active
        if (this.cameraShakeSystem && this.cameraShakeSystem.shakeIntensity > 0) {
            const time = performance.now() / 1000;
            
            this.camera.position.x += Math.sin(time * 30) * 
                this.cameraShakeSystem.shakeIntensity * 0.5;
            this.camera.position.y += Math.cos(time * 27) * 
                this.cameraShakeSystem.shakeIntensity * 0.3;
        }

        // Render scene with all entities and effects
        this.renderer.render(this.scene, this.camera);
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

    destroy() {
        // Clean up resources
        this.inputManager.destroy();
        
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
        this.container = null;
        this.inputManager = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
    }
}

export default SpaceInvadersApp;
