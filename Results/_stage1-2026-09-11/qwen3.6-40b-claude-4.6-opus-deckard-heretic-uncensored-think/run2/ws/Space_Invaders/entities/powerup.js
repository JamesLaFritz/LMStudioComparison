import * as THREE from 'three';
import { clamp } from '../shared/mathUtils.js';

export class PowerUp {
    constructor(type, position) {
        this.type = type; // 'shield', 'rapidFire', 'bomb'
        this.position = position.clone();
        this.velocity = new THREE.Vector3(0, -0.5, 0);
        this.rotationSpeed = Math.random() * 2;
        this.active = true;
        this.mesh = null;
        this.duration = 10; // seconds active before disappearing
        
        this.createMesh();
    }
    
    createMesh() {
        const geometry = new THREE.SphereGeometry(0.3, 8, 8);
        
        let color;
        switch(this.type) {
            case 'shield': color = 0x06B1FF; break; // Blue shield
            case 'rapidFire': color = 0xFFD700; break; // Gold rapid fire
            case 'bomb': color = 0xFF4500; break; // Red bomb
        }
        
        this.material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.8,
            metalness: 0.3,
            roughness: 0.4
        });
        
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.copy(this.position);
        
        // Add glow effect
        const light = new THREE.PointLight(color, 2, 5);
        light.position.set(0, 0, 0);
        this.mesh.add(light);
    }
    
    update(dt) {
        if (!this.active) return;
        
        // Move downward slowly
        this.position.y += this.velocity.y * dt;
        
        // Rotate for visual effect
        this.mesh.rotation.y += this.rotationSpeed * dt;
        this.mesh.rotation.x += this.rotationSpeed * 0.5 * dt;
        
        // Update mesh position
        if (this.mesh) {
            this.mesh.position.copy(this.position);
        }
        
        // Check bounds
        if (this.position.y < -15) {
            this.active = false;
        }
    }
    
    getBounds() {
        return new THREE.Box3(
            this.position.x - 0.3,
            this.position.y - 0.3,
            this.position.z - 0.3,
            this.position.x + 0.3,
            this.position.y + 0.3,
            this.position.z + 0.3
        );
    }
    
    dispose() {
        if (this.mesh) {
            this.mesh.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
        }
    }
}
