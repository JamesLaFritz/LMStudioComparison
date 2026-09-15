import * as THREE from 'three';
import { clamp } from '../shared/mathUtils.js';

export class ProjectilePool {
    constructor() {
        this.projectiles = [];
        this.activeProjectiles = [];
        
        // Create shared geometry and material for player projectiles
        this.playerGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.1);
        this.playerMaterial = new THREE.MeshStandardMaterial({
            color: '#00ff88',
            emissive: '#00ff88',
            emissiveIntensity: 2.0,
            metalness: 0.5,
            roughness: 0.3
        });
        
        // Create shared geometry and material for enemy projectiles
        this.enemyGeometry = new THREE.SphereGeometry(0.15);
        this.enemyMaterial = new THREE.MeshStandardMaterial({
            color: '#ff4444',
            emissive: '#ff4444',
            emissiveIntensity: 2.0,
            metalness: 0.3,
            roughness: 0.5
        });
        
        // Initialize pool with projectiles
        for (let i = 0; i < 100; i++) {
            this.createProjectile();
        }
    }
    
    createProjectile() {
        const projectile = {
            mesh: null,
            isPlayerProjectile: false,
            active: false,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            speed: 0,
            damage: 1,
            trailPoints: [],
            trailLength: 20,
            life: 5.0 // seconds before expiration
        };
        
        this.projectiles.push(projectile);
    }
    
    spawnPlayerProjectile(position) {
        const projectile = this.projectiles.find(p => !p.active);
        if (!projectile) return null;
        
        projectile.active = true;
        projectile.isPlayerProjectile = true;
        projectile.position.copy(position);
        projectile.velocity.set(0, 15, 0); // Upward velocity
        projectile.speed = 15;
        projectile.trailPoints = [];
        projectile.life = 5.0;
        
        if (!projectile.mesh) {
            projectile.mesh = new THREE.Mesh(this.playerGeometry, this.playerMaterial);
            projectile.mesh.position.copy(position);
            // Add glow effect using a larger transparent mesh
            const glowMesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.4, 0.2),
                new THREE.MeshStandardMaterial({
                    color: '#00ff88',
                    emissive: '#00ff88',
                    emissiveIntensity: 1.5,
                    transparent: true,
                    opacity: 0.3
                })
            );
            projectile.mesh.add(glowMesh);
        }
        
        projectile.mesh.visible = true;
        projectile.mesh.position.copy(position);
        
        this.activeProjectiles.push(projectile);
        return projectile;
    }
    
    spawnEnemyProjectile(position, targetPosition) {
        const projectile = this.projectiles.find(p => !p.active);
        if (!projectile) return null;
        
        projectile.active = true;
        projectile.isPlayerProjectile = false;
        projectile.position.copy(position);
        
        // Calculate velocity toward player (with some randomness)
        const direction = new THREE.Vector3()
            .sub(targetPosition, position)
            .normalize();
        
        // Add slight randomness to make it harder to dodge
        direction.x += Math.random() * 0.5 - 0.25;
        direction.y = -Math.abs(direction.y); // Always downward
        
        projectile.velocity = direction.multiplyScalar(8); // Slower than player projectiles
        projectile.speed = 8;
        projectile.trailPoints = [];
        projectile.life = 10.0;
        
        if (!projectile.mesh) {
            projectile.mesh = new THREE.Mesh(this.enemyGeometry, this.enemyMaterial);
            projectile.mesh.position.copy(position);
            
            // Add pulsing glow effect
            const glowMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.25),
                new THREE.MeshStandardMaterial({
                    color: '#ff4444',
                    emissive: '#ff4444',
                    emissiveIntensity: 1.5,
                    transparent: true,
                    opacity: 0.3
                })
            );
            projectile.mesh.add(glowMesh);
        }
        
        projectile.mesh.visible = true;
        projectile.mesh.position.copy(position);
        
        this.activeProjectiles.push(projectile);
        return projectile;
    }
    
    update(dt, scene) {
        // Update all active projectiles
        for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.activeProjectiles[i];
            
            if (!projectile.active) continue;
            
            // Update position
            projectile.position.add(projectile.velocity.clone().multiplyScalar(dt));
            projectile.mesh.position.copy(projectile.position);
            
            // Add trail point
            projectile.trailPoints.push(projectile.position.clone());
            if (projectile.trailPoints.length > projectile.trailLength) {
                projectile.trailPoints.shift();
            }
            
            // Update life
            projectile.life -= dt;
            
            // Remove if expired or out of bounds
            if (projectile.life <= 0 || Math.abs(projectile.position.y) > 20) {
                this.removeProjectile(i);
            }
        }
    }
    
    removeProjectile(index) {
        const projectile = this.activeProjectiles[index];
        
        // Deactivate the projectile
        projectile.active = false;
        if (projectile.mesh) {
            projectile.mesh.visible = false;
        }
        
        // Remove from active list and add back to pool
        this.activeProjectiles.splice(index, 1);
    }
    
    clear() {
        for (const projectile of this.activeProjectiles) {
            projectile.active = false;
            if (projectile.mesh) {
                projectile.mesh.visible = false;
            }
        }
        this.activeProjectiles.length = 0;
    }
}
