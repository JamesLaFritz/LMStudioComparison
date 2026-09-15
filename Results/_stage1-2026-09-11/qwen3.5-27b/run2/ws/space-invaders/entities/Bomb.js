import * as THREE from 'three';
import { GeometryPool } from '../../shared/rendering/GeometryPool.js';

export class Bomb {
    constructor() {
        this.geometry = GeometryPool.get('sphere');
        this.material = new THREE.MeshStandardMaterial({
            color: 0xff3300,
            emissive: 0xff6600,
            emissiveIntensity: 1.5,
            metalness: 0.7,
            roughness: 0.3
        });
        
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.visible = false;
        
        this.velocity = new THREE.Vector3(0, -40, 0);
        this.active = false;
        this.position = new THREE.Vector3();
    }

    activate(x, y) {
        this.active = true;
        this.mesh.position.set(x, y, 0);
        this.mesh.visible = true;
        this.velocity.y = -40; // Downward velocity
    }

    deactivate() {
        this.active = false;
        this.mesh.visible = false;
    }

    update(delta) {
        if (!this.active) return;
        
        this.mesh.position.addScaledVector(this.velocity, delta);
        
        // Deactivate if below player area
        if (this.mesh.position.y < -10) {
            this.deactivate();
        }
    }

    dispose() {
        this.material.dispose();
        this.mesh.geometry = null;
        this.mesh.material = null;
    }
}
