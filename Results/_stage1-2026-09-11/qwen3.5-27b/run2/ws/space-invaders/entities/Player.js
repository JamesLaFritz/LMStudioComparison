import * as THREE from 'three';
import PBRMaterialFactory from '../../shared/rendering/PBRMaterialFactory.js';
import { GeometryPool } from '../../shared/rendering/GeometryPool.js';

export class Player {
    constructor(scene, cameraShake, particleManager, motionTrails) {
        this.scene = scene;
        this.cameraShake = cameraShake;
        this.particleManager = particleManager;
        this.motionTrails = motionTrails;
        
        // Position and velocity
        this.position = new THREE.Vector3(0, -8, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        // Movement properties
        this.speed = 12;
        this.moveDirection = 0; // -1 left, 0 none, 1 right
        
        // Shooting properties
        this.fireCooldown = 0;
        this.baseFireRate = 0.4; // seconds between shots
        
        // Power-ups
        this.hasSpreadShot = false;
        this.hasRapidFire = false;
        this.spreadShotTimer = 0;
        this.rapidFireTimer = 0;
        
        // Shield
        this.shieldActive = false;
        this.shieldHealth = 1;
        
        // State
        this.isDead = false;
        
        // Create mesh
        this.createMesh();
    }

    createMesh() {
        const geometry = GeometryPool.get('playerShip');
        const material = PBRMaterialFactory.createNeonGlowMaterial(0x00ffff, 2);
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        
        // Add glow point light
        this.glowLight = new THREE.PointLight(0x00ffff, 1.5, 12);
        this.glowLight.position.set(0, -1, 0);
        this.mesh.add(this.glowLight);
        
        // Shield mesh (hidden by default)
        const shieldGeometry = GeometryPool.get('shield');
        const shieldMaterial = PBRMaterialFactory.createEnergyShieldMaterial();
        this.shieldMesh = new THREE.Mesh(shieldGeometry, shieldMaterial);
        this.shieldMesh.position.copy(this.position);
        this.shieldMesh.visible = false;
        
        this.scene.add(this.mesh);
        this.scene.add(this.shieldMesh);
    }

    update(delta, input) {
        if (this.isDead) return;
        
        // Get movement direction from input
        const leftPressed = input.keys.left || input.gamepad.left;
        const rightPressed = input.keys.right || input.gamepad.right;
        
        this.moveDirection = 0;
        if (leftPressed && !rightPressed) {
            this.moveDirection = -1;
        } else if (rightPressed && !leftPressed) {
            this.moveDirection = 1;
        }
        
        // Apply movement
        if (this.moveDirection !== 0) {
            const moveAmount = this.speed * delta * this.moveDirection;
            this.position.x += moveAmount;
            
            // Clamp to viewport bounds
            this.position.x = Math.max(-12, Math.min(12, this.position.x));
        }
        
        // Update mesh position
        this.mesh.position.copy(this.position);
        this.shieldMesh.position.copy(this.position);
        
        // Update fire cooldown
        if (this.fireCooldown > 0) {
            this.fireCooldown -= delta;
        }
        
        // Update power-up timers
        if (this.hasSpreadShot) {
            this.spreadShotTimer -= delta;
            if (this.spreadShotTimer <= 0) {
                this.hasSpreadShot = false;
            }
        }
        
        if (this.hasRapidFire) {
            this.rapidFireTimer -= delta;
            if (this.rapidFireTimer <= 0) {
                this.hasRapidFire = false;
            }
        }
        
        // Update shield visibility and rotation
        this.shieldMesh.visible = this.shieldActive && this.shieldHealth > 0;
        if (this.shieldMesh.visible) {
            this.shieldMesh.rotation.y += 3 * delta;
        }
    }

    tryShoot(getBullet) {
        if (!this.canFire() || this.isDead) return null;
        
        const currentFireRate = this.hasRapidFire ? 0.2 : this.baseFireRate;
        this.fireCooldown = currentFireRate;
        
        // Determine angles for spread shot
        const angles = this.hasSpreadShot 
            ? [-0.26, 0, 0.26] // -15°, 0°, +15° in radians
            : [0];
        
        const bullets = [];
        for (const angle of angles) {
            const bullet = getBullet();
            if (!bullet) continue;
            
            const velocity = new THREE.Vector3(Math.sin(angle), Math.cos(angle), 0).multiplyScalar(80);
            bullet.activate(this.position.x, this.position.z, velocity);
            bullets.push(bullet);
        }
        
        return angles.length === 1 ? bullets[0] : bullets;
    }

    canFire() {
        return this.fireCooldown <= 0 && !this.isDead;
    }

    activatePowerUp(type) {
        switch (type) {
            case 'spread':
                this.activateSpreadShot(10);
                break;
            case 'rapid':
                this.activateRapidFire(10);
                break;
            case 'shield':
                this.activateShield();
                break;
        }
    }

    activateSpreadShot(duration = 10) {
        this.hasSpreadShot = true;
        this.spreadShotTimer = duration;
    }

    activateRapidFire(duration = 10) {
        this.hasRapidFire = true;
        this.rapidFireTimer = duration;
    }

    activateShield() {
        this.shieldActive = true;
        this.shieldHealth = 1;
        this.shieldMesh.material.opacity = 0.6;
    }

    takeBombHit() {
        if (this.shieldActive && this.shieldHealth > 0) {
            this.shieldHealth--;
            this.shieldMesh.material.opacity = Math.max(0, this.shieldHealth / 2);
            
            if (this.shieldHealth <= 0) {
                this.shieldActive = false;
                this.shieldMesh.visible = false;
            }
            return true; // Blocked by shield
        }
        return false; // Direct hit
    }

    die(particleManager, shockwaveRings) {
        this.isDead = true;
        
        // Spawn death particles
        if (particleManager) {
            particleManager.spawnExplosion(this.position.clone(), 60);
        }
        
        // Spawn shockwave
        if (shockwaveRings) {
            shockwaveRings.spawn(this.position.clone(), 6, 0xff0000);
        }
        
        // Hide mesh
        this.mesh.visible = false;
        this.shieldMesh.visible = false;
    }

    respawn() {
        this.isDead = false;
        this.position.set(0, -8, 0);
        this.mesh.position.copy(this.position);
        this.shieldMesh.position.copy(this.position);
        this.mesh.visible = true;
        
        // Reset power-ups
        this.hasSpreadShot = false;
        this.hasRapidFire = false;
        this.spreadShotTimer = 0;
        this.rapidFireTimer = 0;
    }

    dispose() {
        // Remove from scene
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
            if (this.shieldMesh) {
                this.scene.remove(this.shieldMesh);
            }
        }
        
        // Dispose materials and geometries
        if (this.glowLight) {
            this.glowLight.dispose();
        }
    }
}
