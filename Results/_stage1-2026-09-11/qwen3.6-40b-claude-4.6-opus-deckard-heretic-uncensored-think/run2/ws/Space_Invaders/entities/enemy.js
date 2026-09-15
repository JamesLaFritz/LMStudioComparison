import * as THREE from 'three';
import { clamp } from '../shared/mathUtils.js';
import { noise2D } from '../shared/noiseFunctions.js';

export class Enemy {
    constructor(type, x, y) {
        this.type = type; // 'basic', 'medium', 'elite'
        this.position = new THREE.Vector3(x, y, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.health = this.getHealth();
        this.maxHealth = this.getHealth();
        
        // Movement state
        this.direction = 1;
        this.moveTimer = 0;
        this.moveInterval = this.getMoveInterval();
        
        // Shooting state
        this.shootTimer = Math.random() * 2;
        this.shootInterval = this.getShootInterval();
        
        // Visual properties
        this.scale = new THREE.Vector3(1, 1, 1);
        this.rotationSpeed = 0.5;
        
        // Animation state
        this.animationTimer = 0;
        this.wingAngle = 0;
        
        // Formation position tracking
        this.basePosition = new THREE.Vector3(x, y, 0);
    }

    getHealth() {
        const healthMap = { basic: 1, medium: 2, elite: 3 };
        return healthMap[this.type] || 1;
    }

    getMoveInterval() {
        const intervals = { basic: 0.8, medium: 0.6, elite: 0.4 };
        return intervals[this.type] || 0.8;
    }

    getShootInterval() {
        const intervals = { basic: 3, medium: 2, elite: 1.5 };
        return intervals[this.type] || 3;
    }

    update(dt, formationDirection) {
        // Update movement direction based on formation
        this.direction = formationDirection;
        
        // Horizontal movement with sine wave pattern
        const moveSpeed = 2 * this.getMoveInterval();
        this.position.x += this.direction * moveSpeed * dt;
        
        // Add subtle vertical bobbing for visual interest
        this.animationTimer += dt;
        this.wingAngle = Math.sin(this.animationTimer * 3) * 0.1;
        this.position.y = this.basePosition.y + Math.sin(this.animationTimer * 2) * 0.2;
        
        // Update shooting timer
        this.shootTimer -= dt;
        
        // Apply noise-based movement for organic feel
        const noiseX = noise2D(this.position.x * 0.1, this.position.y * 0.1);
        this.velocity.x += noiseX * 0.5 * dt;
    }

    shouldShoot() {
        return this.shootTimer <= 0;
    }

    resetShootTimer() {
        this.shootTimer = Math.random() * this.getShootInterval();
    }

    takeDamage(amount) {
        this.health -= amount;
        return this.health <= 0;
    }

    getBounds() {
        const size = new THREE.Vector3(1, 1, 1);
        return {
            min: new THREE.Vector3(this.position.x - size.x/2, this.position.y - size.y/2),
            max: new THREE.Vector3(this.position.x + size.x/2, this.position.y + size.y/2)
        };
    }

    getScoreValue() {
        const scores = { basic: 10, medium: 25, elite: 50 };
        return scores[this.type] || 10;
    }
}

export class EnemyFormation {
    constructor(rows, cols) {
        this.enemies = [];
        this.direction = 1; // 1 = right, -1 = left
        this.moveSpeed = 2.0;
        this.level = 0;
        
        // Initialize formation grid
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = (col - cols/2) * 3;
                const y = -(row + 1) * 2.5;
                
                // Determine enemy type based on position
                let type = 'basic';
                if (row === 0 || row === rows - 1) {
                    type = 'elite';
                } else if (row >= 1 && row <= rows - 2) {
                    type = 'medium';
                }
                
                this.enemies.push(new Enemy(type, x, y));
            }
        }
    }

    update(dt, screenEdge) {
        // Update individual enemies
        this.enemies.forEach(enemy => {
            enemy.update(dt, this.direction);
            
            // Check for edge collision and reverse direction
            if (Math.abs(enemy.position.x) > screenEdge) {
                this.reverseDirection();
            }
        });
        
        // Increase speed as enemies are destroyed
        const totalEnemies = this.enemies.length;
        const initialCount = 42; // Approximate starting count
        this.moveSpeed = 2.0 * (1 + (initialCount - totalEnemies) / initialCount);
    }

    reverseDirection() {
        this.direction *= -1;
        
        // Move all enemies down when reversing
        this.enemies.forEach(enemy => {
            enemy.basePosition.y -= 0.5;
            enemy.position.y = enemy.basePosition.y;
        });
    }

    getActiveEnemies() {
        return this.enemies.filter(enemy => enemy.health > 0);
    }

    isFormationDestroyed() {
        return this.enemies.every(enemy => enemy.health <= 0);
    }
}
