import * as THREE from 'three';
import { clamp } from '../shared/mathUtils.js';

export class Player {
    constructor(position, inputController) {
        this.group = new THREE.Group();
        this.group.position.copy(position);
        
        this.inputController = inputController;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.maxSpeed = 6.0;
        this.acceleration = 15.0;
        this.deceleration = 25.0;
        
        this.health = 100;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        
        // Create player ship geometry
        this.createShip();
    }

    createShip() {
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.2, 0.8, 1.0),
            emissive: new THREE.Color(0.3, 0.6, 1.0),
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.7
        });

        // Main body - sleek triangular shape
        const bodyGeometry = new THREE.BoxGeometry(2.0, 0.3, 1.0);
        this.body = new THREE.Mesh(bodyGeometry, material);
        
        // Wings
        const wingGeometry = new THREE.BoxGeometry(4.0, 0.15, 0.8);
        this.wings = new THREE.Mesh(wingGeometry, material);
        
        // Cockpit - glowing center
        const cockpitGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const cockpitMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(1.0, 1.0, 1.0),
            emissive: new THREE.Color(0.5, 0.8, 1.0),
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.7
        });
        this.cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        this.cockpit.position.y = 0.2;
        
        // Engine glow
        const engineGeometry = new THREE.CylinderGeometry(0.15, 0.25, 0.6, 8);
        const engineMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(1.0, 0.7, 0.3),
            emissive: new THREE.Color(1.0, 0.6, 0.2),
            emissiveIntensity: 2.0
        });
        
        this.leftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
        this.leftEngine.position.set(-0.8, -0.3, 0);
        
        this.rightEngine = new THREE.Mesh(engineonometry.clone(), engineMaterial);
        this.rightEngine.position.set(0.8, -0.3, 0);
        
        // Add all parts to group
        this.group.add(this.body);
        this.group.add(this.wings);
        this.group.add(this.cockpit);
        this.group.add(this.leftEngine);
        this.group.add(this.rightEngine);
    }

    update(dt) {
        // Handle input
        const horizontalInput = this.inputController.getHorizontalAxis();
        
        if (Math.abs(horizontalInput) > 0.1) {
            this.velocity.x += horizontalInput * this.acceleration * dt;
        } else {
            // Apply deceleration
            this.velocity.x *= Math.pow(0.95, dt * 60);
        }

        // Clamp velocity
        this.velocity.x = clamp(this.velocity.x, -this.maxSpeed, this.maxSpeed);

        // Update position
        this.group.position.x += this.velocity.x * dt;

        // Keep within bounds
        const boundary = 12.0;
        this.group.position.x = clamp(this.group.position.x, -boundary, boundary);

        // Handle invulnerability
        if (this.isInvulnerable) {
            this.invulnerabilityTimer -= dt;
            
            // Flash effect
            const flashSpeed = Math.sin(Date.now() * 0.05) > 0;
            this.group.visible = flashSpeed;
            
            if (this.invulnerabilityTimer <= 0) {
                this.isInvulnerable = false;
                this.group.visible = true;
            }
        }

        // Update engine glow based on speed
        const speedRatio = Math.abs(this.velocity.x) / this.maxSpeed;
        const engineScale = 1.0 + speedRatio * 0.3;
        
        this.leftEngine.scale.set(engineScale, engineScale, engineScale);
        this.rightEngine.scale.set(engineScale, engineScale, engineScale);
    }

    takeDamage(amount) {
        if (this.isInvulnerable) return false;
        
        this.health -= amount;
        return this.health <= 0;
    }

    getBounds() {
        return {
            minX: this.group.position.x - 1.5,
            maxX: this.group.position.x + 1.5,
            minY: this.group.position.y - 0.3,
            maxY: this.group.position.y + 0.3,
            minZ: this.group.position.z - 0.8,
            maxZ: this.group.position.z + 0.8
        };
    }

    getPosition() {
        return this.group.position;
    }

    dispose() {
        // Dispose all geometries and materials
        const traverse = (obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            obj.children.forEach(child => traverse(child));
        };
        
        traverse(this.group);
    }
}
