// Player entity for Space Invaders
import * as THREE from 'three';
import { vec2, vec2Copy, vec2Len } from '../../shared/math/VectorMath.js';
import { createStandardMaterial, createEmissiveMaterial } from '../../shared/graphics/ProceduralAssets.js';

export class Player {
    constructor(config) {
        this.position = vec2Copy([0, 0], config.position || [0, 0]);
        this.velocity = vec2(0, 0);
        this.moveSpeed = config.moveSpeed || 300;
        this.fireCooldown = 0;
        this.fireRate = config.fireRate || 0.25;
        this.lives = config.lives || 3;
        this.maxLives = this.lives;
        this.arenaBounds = config.arenaBounds || [-4, 4];
        this.alive = true;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.invincibleDuration = 2.0;
        this.scale = config.scale || 1.0;
        this.blinkTimer = 0;
        this.blinkInterval = 0.1;

        // Create player ship geometry
        this.mesh = this._createShip();
        this.mesh.position.set(this.position[0], this.position[1], 0);
        this.mesh.scale.setScalar(this.scale);
    }

    _createShip() {
        const group = new THREE.Group();

        // Main body - triangular shape
        const bodyGeo = new THREE.ConeGeometry(0.4, 0.8, 4);
        const bodyMat = createStandardMaterial(0x00ffff, 0.3, 0.7);
        bodyMat.emissive = new THREE.Color(0x004444);
        bodyMat.emissiveIntensity = 0.5;
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.y = Math.PI / 4;
        group.add(body);

        // Wings
        const wingGeo = new THREE.BoxGeometry(1.2, 0.1, 0.3);
        const wingMat = createStandardMaterial(0x00cccc, 0.4, 0.6);
        const wings = new THREE.Mesh(wingGeo, wingMat);
        wings.position.y = -0.2;
        group.add(wings);

        // Engine glow
        const engineGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const engineMat = createEmissiveMaterial(0x00ffff, 2.0);
        const engine = new THREE.Mesh(engineGeo, engineMat);
        engine.position.y = -0.4;
        engine.name = 'engine';
        group.add(engine);

        return group;
    }

    update(dt, input) {
        if (!this.alive) return;

        // Handle invincibility
        if (this.invincible) {
            this.invincibleTimer -= dt;
            this.blinkTimer += dt;
            if (this.blinkTimer >= this.blinkInterval) {
                this.blinkTimer = 0;
                this.mesh.visible = !this.mesh.visible;
            }
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
                this.mesh.visible = true;
            }
        }

        // Movement
        const moveX = input.getAxis('moveX');
        this.velocity[0] = moveX * this.moveSpeed;

        // Apply movement
        this.position[0] += this.velocity[0] * dt;

        // Clamp to arena bounds
        this.position[0] = Math.max(
            this.arenaBounds[0],
            Math.min(this.arenaBounds[1], this.position[0])
        );

        // Update mesh position
        this.mesh.position.x = this.position[0];
        this.mesh.position.y = this.position[1];

        // Engine glow intensity based on movement
        const engine = this.mesh.getObjectByName('engine');
        if (engine) {
            const intensity = 1.0 + Math.abs(moveX) * 2.0;
            engine.material.emissiveIntensity = intensity;
        }
    }

    canFire() {
        return this.fireCooldown <= 0 && this.alive;
    }

    fire() {
        if (!this.canFire()) return null;
        this.fireCooldown = this.fireRate;
        return {
            position: vec2.copy([this.position[0], this.position[1] + 0.5]),
            velocity: [0, 400],
            type: 'player'
        };
    }

    takeDamage() {
        if (this.invincible || !this.alive) return false;

        this.lives--;
        if (this.lives <= 0) {
            this.alive = false;
            this.mesh.visible = false;
            return true; // Player died
        }

        // Become invincible
        this.invincible = true;
        this.invincibleTimer = this.invincibleDuration;
        this.blinkTimer = 0;
        return false; // Player survived
    }

    reset() {
        this.lives = this.maxLives;
        this.alive = true;
        this.invincible = true;
        this.invincibleTimer = this.invincibleDuration;
        this.blinkTimer = 0;
        this.position[0] = 0;
        this.position[1] = 0;
        this.velocity[0] = 0;
        this.mesh.visible = true;
        this.mesh.position.set(0, 0, 0);
    }

    dispose() {
        this.mesh.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (child.material) {
                    child.material.dispose();
                }
            }
        });
    }
}
