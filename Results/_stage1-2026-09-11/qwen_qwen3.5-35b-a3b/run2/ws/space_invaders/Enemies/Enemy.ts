import { Vector3, Color } from 'three';
import { ObjectPool } from '../../shared/core/ObjectPool';
import { createEnemyTexture, EnemyType } from '../../shared/utils/ProceduralTextures';

export interface EnemyConfig {
    type: EnemyType;
    position: Vector3;
}

export class Enemy {
    public mesh: THREE.Mesh;
    public position: Vector3 = new Vector3();
    public velocity: Vector3 = new Vector3();
    public health: number = 1;
    public scoreValue: number = 0;
    public isDead: boolean = false;
    public type: EnemyType;

    private static readonly TYPES = {
        grunt: { health: 1, speed: 1.0, score: 30, color: '#00FF00' },
        elite: { health: 2, speed: 1.5, score: 60, color: '#FF00FF' },
        boss: { health: 5, speed: 0.7, score: 150, color: '#FFD700' }
    };

    constructor(config: EnemyConfig) {
        this.type = config.type;
        const typeData = Enemy.TYPES[config.type];
        
        this.health = typeData.health;
        this.scoreValue = typeData.score;
        
        // Create procedural texture
        const texture = createEnemyTexture(config.type);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            emissive: new Color(typeData.color),
            emissiveIntensity: 0.5 + (this.health / typeData.health) * 1.5,
            metalness: 0.6,
            roughness: 0.3
        });

        // Create enemy mesh with retro-futuristic shape
        const geometry = new THREE.BoxGeometry(2, 1.5, 1);
        this.mesh = new THREE.Mesh(geometry, material);
        
        this.position.copy(config.position);
        this.mesh.position.copy(this.position);
    }

    public update(deltaTime: number, direction: number, baseSpeed: number): void {
        if (this.isDead) return;

        const typeData = Enemy.TYPES[this.type];
        const speedMultiplier = 1 + (0.3 * (55 - this.getAliveCount()) / 55);
        const currentSpeed = baseSpeed * direction * typeData.speed * speedMultiplier * deltaTime;

        this.position.x += currentSpeed;
        this.mesh.position.x = this.position.x;
    }

    public takeDamage(): void {
        this.health--;
        if (this.health <= 0) {
            this.isDead = true;
        } else {
            // Update emissive intensity based on remaining health
            const typeData = Enemy.TYPES[this.type];
            const material = this.mesh.material as THREE.MeshStandardMaterial;
            material.emissiveIntensity = 0.5 + (this.health / typeData.health) * 1.5;
        }
    }

    public getAliveCount(): number {
        // This will be overridden by the game manager
        return 55;
    }

    public dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.MeshStandardMaterial).map?.dispose();
        this.mesh.material.dispose();
    }
}

export class EnemyManager {
    private enemies: Enemy[] = [];
    private pool: ObjectPool<Enemy> | null = null;
    public direction: number = 1;
    public baseSpeed: number = 20.0;
    public dropDistance: number = 2.0;

    constructor() {
        this.initializeFormation();
    }

    private initializeFormation(): void {
        const rows = 5;
        const cols = 11;
        const startX = -30;
        const startY = -15;
        const spacingX = 4.5;
        const spacingY = 2.5;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                let type: EnemyType = 'grunt';
                
                // Elite enemies in rows 1-3, columns 2-8
                if (row >= 1 && row <= 3 && col >= 2 && col <= 8) {
                    type = 'elite';
                }

                const position = new Vector3(
                    startX + col * spacingX,
                    startY - row * spacingY,
                    0
                );

                this.enemies.push(new Enemy({
                    type: type,
                    position: position
                }));
            }
        }
    }

    public update(deltaTime: number): void {
        let hitEdge = false;
        const LEFT_BOUNDARY = -30;
        const RIGHT_BOUNDARY = 30;

        // Check if any enemy reached the edge
        for (const enemy of this.enemies) {
            if (!enemy.isDead && 
                (enemy.position.x <= LEFT_BOUNDARY || enemy.position.x >= RIGHT_BOUNDARY)) {
                hitEdge = true;
                break;
            }
        }

        if (hitEdge) {
            // Flip direction and drop down
            this.direction *= -1;
            
            for (const enemy of this.enemies) {
                if (!enemy.isDead) {
                    enemy.position.y -= this.dropDistance;
                    enemy.mesh.position.y = enemy.position.y;
                }
            }
        }

        // Update all enemies
        for (const enemy of this.enemies) {
            if (!enemy.isDead) {
                enemy.update(deltaTime, this.direction, this.baseSpeed);
            }
        }
    }

    public getAliveCount(): number {
        return this.enemies.filter(e => !e.isDead).length;
    }

    public getAllEnemies(): Enemy[] {
        return this.enemies.filter(e => !e.isDead);
    }

    public reset(): void {
        for (const enemy of this.enemies) {
            enemy.isDead = false;
            const typeData = Enemy.TYPES[enemy.type];
            enemy.health = typeData.health;
        }
        this.direction = 1;
        this.initializeFormation();
    }

    public dispose(): void {
        for (const enemy of this.enemies) {
            enemy.dispose();
        }
        if (this.pool) {
            this.pool.clear();
        }
    }
}