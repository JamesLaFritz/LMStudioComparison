import * as THREE from 'three';
import { GeometryPool } from '../../shared/rendering/GeometryPool.js';
import { PBRMaterialFactory } from '../../shared/rendering/PBRMaterialFactory.js';

export class InvaderGrid {
    constructor(scene, particleManager, shockwaveRings, floatingTextPool, hitStopManager) {
        this.scene = scene;
        this.particleManager = particleManager;
        this.shockwaveRings = shockwaveRings;
        this.floatingTextPool = floatingTextPool;
        this.hitStopManager = hitStopManager;
        
        // Grid configuration
        this.rows = 5;
        this.cols = 10;
        this.totalInvaders = this.rows * this.cols;
        
        // Movement state
        this.direction = 1; // 1 = right, -1 = left
        this.baseSpeed = 2.0;
        this.currentSpeed = this.baseSpeed;
        this.dropDistance = 1.5;
        this.moveTimer = 0;
        this.stepSize = 0.8;
        
        // Invader data storage
        this.invaders = [];
        
        // Shooting state
        this.shootCooldown = 0;
        this.minShootInterval = 1.5;
        
        // Animation state
        this.animationTimer = 0;
        this.animationFrame = 0;
        
        // Level multiplier
        this.levelMultiplier = 1;
        
        // Initialize invader data
        this.initInvaders();
    }

    initInvaders() {
        const spacingX = 2.5;
        const spacingY = 1.8;
        const startX = -((this.cols - 1) * spacingX) / 2;
        
        // Clear existing invaders
        this.invaders = [];
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                // Determine invader type based on row
                let type, points, color;
                if (row <= 1) {
                    type = 'squid';
                    points = 30;
                    color = 0xFF6B9D;
                } else if (row <= 3) {
                    type = 'crab';
                    points = 20;
                    color = 0x4ECDC4;
                } else {
                    type = 'octopus';
                    points = 10;
                    color = 0xFFE66D;
                }
                
                this.invaders.push({
                    row: row,
                    col: col,
                    type: type,
                    points: points,
                    color: color,
                    x: startX + col * spacingX,
                    y: 4 - row * spacingY,
                    alive: true,
                    animationOffset: Math.random() * Math.PI * 2,
                    mesh: null
                });
            }
        }
        
        // Create meshes for all invaders
        this.createInvaderMeshes();
    }

    createInvaderMeshes() {
        const geometryMap = {};
        const materialMap = {};
        
        // Create geometries and materials for each type
        ['squid', 'crab', 'octopus'].forEach(type => {
            const color = this.getColorForType(type);
            
            if (!geometryMap[type]) {
                geometryMap[type] = GeometryPool.get('invader');
            }
            
            if (!materialMap[type]) {
                materialMap[type] = PBRMaterialFactory.createNeonMaterial(color, 2.0);
            }
        });

        // Create mesh for each invader
        this.invaders.forEach(invader => {
            const geometry = geometryMap[invader.type];
            const material = materialMap[invader.type].clone();
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(invader.x, invader.y, 0);
            mesh.scale.set(1.2, 1.2, 1.2);
            
            this.scene.add(mesh);
            invader.mesh = mesh;
        });
    }

    getColorForType(type) {
        switch (type) {
            case 'squid': return 0xFF6B9D;
            case 'crab': return 0x4ECDC4;
            case 'octopus': return 0xFFE66D;
            default: return 0xffffff;
        }
    }

    update(delta) {
        const aliveCount = this.getAliveCount();
        if (aliveCount === 0) return;
        
        // Calculate current speed based on remaining invaders and level
        const populationMultiplier = 1 + (1 - aliveCount / this.totalInvaders);
        this.currentSpeed = this.baseSpeed * this.levelMultiplier * populationMultiplier;
        
        // Update movement timer
        this.moveTimer += delta;
        
        const moveInterval = Math.max(0.03, 0.15 / (this.currentSpeed / this.baseSpeed));
        
        if (this.moveTimer >= moveInterval) {
            this.moveTimer = 0;
            
            // Check edge collision before moving
            let shouldReverse = false;
            const margin = 10;
            
            for (const invader of this.invaders) {
                if (!invader.alive) continue;
                
                if (this.direction === 1 && invader.x + margin > 12) {
                    shouldReverse = true;
                    break;
                } else if (this.direction === -1 && invader.x - margin < -12) {
                    shouldReverse = true;
                    break;
                }
            }
            
            if (shouldReverse) {
                this.direction *= -1;
                // Drop all invaders down
                for (const invader of this.invaders) {
                    if (invader.alive) {
                        invader.y -= this.dropDistance;
                        if (invader.mesh) {
                            invader.mesh.position.y = invader.y;
                        }
                    }
                }
            } else {
                // Move all invaders horizontally
                const moveAmount = this.stepSize * this.direction;
                for (const invader of this.invaders) {
                    if (invader.alive) {
                        invader.x += moveAmount;
                        if (invader.mesh) {
                            invader.mesh.position.x = invader.x;
                        }
                    }
                }
            }
        }
        
        // Update animation timer for bobbing effect
        this.animationTimer += delta;
        const bobSpeed = 2 + this.levelMultiplier * 0.5;
        if (this.animationTimer >= 0.15) {
            this.animationTimer = 0;
            this.animationFrame = (this.animationFrame + 1) % 4;
            
            // Apply bobbing animation to all invaders
            const bobAmount = Math.sin(this.animationFrame * Math.PI / 2) * 0.15;
            for (const invader of this.invaders) {
                if (invader.alive && invader.mesh) {
                    invader.mesh.position.y = invader.y + bobAmount;
                    // Scale effect based on animation frame
                    const scale = 1 + (this.animationFrame === 2 ? 0.1 : 0);
                    invader.mesh.scale.set(1.2 * scale, 1.2 * scale, 1.2 * scale);
                }
            }
        }
    }

    getAliveCount() {
        return this.invaders.filter(i => i.alive).length;
    }

    isCleared() {
        return this.getAliveCount() === 0;
    }

    hasReachedBottom() {
        for (const invader of this.invaders) {
            if (invader.alive && invader.y <= -6) {
                return true;
            }
        }
        return false;
    }

    checkCollision(bullet) {
        const bulletPos = bullet.mesh.position;
        
        for (const invader of this.invaders) {
            if (!invader.alive || !invader.mesh) continue;
            
            // Simple distance-based collision with radius check
            const dx = bulletPos.x - invader.mesh.position.x;
            const dy = bulletPos.y - invader.mesh.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 1.2) {
                return invader;
            }
        }
        
        return null;
    }

    removeInvader(invader) {
        if (!invader.alive || !invader.mesh) return;
        
        invader.alive = false;
        
        // Remove mesh from scene
        this.scene.remove(invader.mesh);
        
        // Dispose geometry and material
        invader.mesh.geometry.dispose();
        invader.mesh.material.dispose();
        invader.mesh = null;
    }

    resetToLevel(level) {
        this.levelMultiplier = 1 + (level - 1) * 0.15;
        
        // Clear existing meshes
        for (const invader of this.invaders) {
            if (invader.mesh) {
                this.scene.remove(invader.mesh);
                invader.mesh.geometry.dispose();
                invader.mesh.material.dispose();
                invader.mesh = null;
            }
        }
        
        // Reinitialize
        this.initInvaders();
        this.direction = 1;
        this.moveTimer = 0;
        this.animationFrame = 0;
    }

    dispose() {
        for (const invader of this.invaders) {
            if (invader.mesh) {
                this.scene.remove(invader.mesh);
                invader.mesh.geometry.dispose();
                invader.mesh.material.dispose();
            }
        }
        this.invaders = [];
    }
}
