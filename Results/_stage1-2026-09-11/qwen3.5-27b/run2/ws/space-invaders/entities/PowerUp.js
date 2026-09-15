import * as THREE from 'three';
import { GeometryPool } from '../../shared/rendering/GeometryPool.js';
import PBRMaterialFactory from '../../shared/rendering/PBRMaterialFactory.js';

export class PowerUp {
    constructor(x, y, type) {
        this.type = type; // 'spread', 'shield', 'rapid', 'health'
        this.active = true;
        this.position = new THREE.Vector3(x, y, 0);
        this.velocity = new THREE.Vector3(0, -2, 0);
        
        const size = 1.5;
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);
        
        // Create power-up orb with type-specific color and symbol
        const colors = {
            spread: 0xff4444,    // Red for spread shot
            shield: 0x44ff44,    // Green for shield
            rapid: 0xffff44,     // Yellow for rapid fire
            health: 0x4444ff     // Blue for health
        };
        
        const color = colors[this.type] || 0xffffff;
        
        // Outer glowing ring
        const ringGeo = GeometryPool.getTorus(0.6, 0.15, 8, 24);
        const ringMat = PBRMaterialFactory.createNeonMaterial(color, 3);
        this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
        this.mesh.add(this.ringMesh);
        
        // Inner core sphere
        const coreGeo = GeometryPool.getSphere(0.4, 16, 16);
        const coreMat = PBRMaterialFactory.createNeonMaterial(color, 2);
        this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
        this.mesh.add(this.coreMesh);
        
        // Pulsing effect variables
        this.pulsePhase = Math.random() * Math.PI * 2;
    }
    
    update(delta) {
        if (!this.active) return;
        
        // Move downward
        this.position.y += this.velocity.y * delta;
        this.mesh.position.copy(this.position);
        
        // Rotate for visual effect
        const rotationSpeed = 3 * delta;
        this.ringMesh.rotation.x += rotationSpeed;
        this.ringMesh.rotation.y += rotationSpeed * 0.7;
        this.coreMesh.rotation.x -= rotationSpeed;
        this.coreMesh.rotation.z += rotationSpeed * 0.5;
        
        // Pulse effect
        this.pulsePhase += 8 * delta;
        const pulseScale = 1 + Math.sin(this.pulsePhase) * 0.2;
        this.ringMesh.scale.setScalar(pulseScale);
        this.coreMesh.scale.setScalar(1 + (pulseScale - 1) * 0.5);
        
        // Check if out of bounds
        if (this.position.y < -12) {
            this.active = false;
        }
    }
    
    dispose() {
        this.ringMesh.geometry.dispose();
        this.ringMesh.material.dispose();
        this.coreMesh.geometry.dispose();
        this.coreMesh.material.dispose();
        
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        this.mesh.clear();
    }
    
    getType() {
        return this.type;
    }
    
    getPosition() {
        return this.position;
    }
}
