/**
 * Space Invaders - Enemy AI System
 * Handles enemy behavior patterns, decision making, and formation logic
 */

import { clamp } from '../../shared/mathUtils.js';

export class AISystem {
    constructor() {
        this.enemies = [];
        this.playerPosition = null;
        this.gameTime = 0;
        
        // AI configuration
        this.config = {
            basic: {
                fireInterval: [2.5, 4.0],
                moveSpeed: 1.0,
                aggression: 0.3
            },
            medium: {
                fireInterval: [1.8, 3.2],
                moveSpeed: 1.3,
                aggression: 0.5
            },
            elite: {
                fireInterval: [1.2, 2.5],
                moveSpeed: 1.6,
                aggression: 0.7
            }
        };
    }

    update(dt) {
        this.gameTime += dt;
        
        // Update all enemy AI behaviors
        for (const enemy of this.enemies) {
            this.updateEnemyAI(enemy, dt);
        }
    }

    addEnemy(enemy) {
        this.enemies.push(enemy);
    }

    removeEnemy(enemy) {
        const index = this.enemies.indexOf(enemy);
        if (index !== -1) {
            this.enemies.splice(index, 1);
        }
    }

    updateEnemyAI(enemy, dt) {
        // Update enemy state based on AI type
        switch (enemy.aiType) {
            case 'basic':
                this.updateBasicEnemy(enemy, dt);
                break;
            case 'medium':
                this.updateMediumEnemy(enemy, dt);
                break;
            case 'elite':
                this.updateEliteEnemy(enemy, dt);
                break;
        }

        // Update fire timer
        enemy.fireTimer -= dt;
        
        // Determine if enemy should fire based on aggression and position
        if (enemy.fireTimer <= 0 && this.shouldFire(enemy)) {
            enemy.fire();
            enemy.fireTimer = enemy.config.fireInterval[0] + 
                Math.random() * (enemy.config.fireInterval[1] - enemy.config.fireInterval[0]));
        }
    }

    updateBasicEnemy(enemy, dt) {
        // Basic enemies just move horizontally and fire randomly
        if (Math.abs(enemy.position.x) > 8) {
            enemy.direction *= -1;
        }
        
        enemy.position.x += enemy.direction * enemy.config.moveSpeed * dt;
    }

    updateMediumEnemy(enemy, dt) {
        // Medium enemies track player slightly and have more aggressive fire pattern
        if (this.playerPosition) {
            const dx = this.playerPosition.x - enemy.position.x;
            enemy.position.x += Math.sign(dx) * 0.3 * dt;
        }
        
        if (Math.abs(enemy.position.x) > 8) {
            enemy.direction *= -1;
        }
    }

    updateEliteEnemy(enemy, dt) {
        // Elite enemies actively track player and have complex movement patterns
        if (this.playerPosition) {
            const dx = this.playerPosition.x - enemy.position.x;
            const dy = this.playerPosition.y - enemy.position.y;
            
            // Move towards player with some randomness for unpredictability
            enemy.position.x += Math.sign(dx) * 0.8 * dt + 
                Math.sin(this.gameTime * 2) * 0.3;
        }
        
        if (Math.abs(enemy.position.x) > 8) {
            enemy.direction *= -1;
        }
    }

    shouldFire(enemy) {
        // Fire probability based on aggression and distance to player
        const distanceToPlayer = this.playerPosition ? 
            Math.sqrt(Math.pow(this.playerPosition.x - enemy.position.x, 2)) : Infinity;
        
        if (distanceToPlayer < 3) {
            return true; // Always fire when close
        }
        
        return Math.random() < enemy.config.aggression * 0.5;
    }

    getFormationPattern(level) {
        const formations = {
            basic: this.createBasicFormation.bind(this),
            medium: this.createMediumFormation.bind(this),
            elite: this.createEliteFormation.bind(this)
        };
        
        return formations[Math.min(level, 3)] || formations.basic;
    }

    createBasicFormation(count) {
        const enemies = [];
        const rows = Math.ceil(count / 10);
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < Math.min(10, count - row * 10); col++) {
                enemies.push({
                    x: -4 + col * 2,
                    y: -3 - row * 2,
                    aiType: 'basic'
                });
            }
        }
        
        return enemies;
    }

    createMediumFormation(count) {
        const enemies = [];
        const rows = Math.ceil(count / 8);
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < Math.min(8, count - row * 8); col++) {
                enemies.push({
                    x: -3 + col * 2.5,
                    y: -4 - row * 2.5,
                    aiType: 'medium'
                });
            }
        }
        
        return enemies;
    }

    createEliteFormation(count) {
        const enemies = [];
        const rows = Math.ceil(count / 6);
        
        for (let row = 0; row < Rows; row++) {
            for (let col = 0; col < Math.min(6, count - row * 6); col++) {
                enemies.push({
                    x: -2.5 + col * 3,
                    y: -5 - row * 3,
                    aiType: 'elite'
                });
            }
        }
        
        return enemies;
    }

    calculateEnemyDamage(enemy) {
        // Damage calculation based on enemy type and level
        const baseDamage = {
            basic: 10,
            medium: 25,
            elite: 50
        };
        
        return baseDamage[enemy.aiType] || 10;
    }

    getEnemySpeedMultiplier(level) {
        // Speed increases with level but caps at reasonable maximum
        return Math.min(1 + (level * 0.2), 3.0);
    }
}

