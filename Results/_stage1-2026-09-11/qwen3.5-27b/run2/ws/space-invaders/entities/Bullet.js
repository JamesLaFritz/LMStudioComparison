import * as THREE from 'three';
import { GeometryPool } from '../../shared/rendering/GeometryPool.js';
import PBRMaterialFactory from '../../shared/rendering/PBRMaterialFactory.js';

export class Bullet {
    constructor() {
        this.active = false;
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3(0, 1, 0);
        this.speed = 80;
        
        // Create bullet mesh
        const geometry = GeometryPool.get('bullet');
        const material = PBRMaterialFactory.createBulletMaterial();
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.visible = false;
        
        // Bounding box for collision
        this.aabb = {
            minX: -0.15, maxX: 0.15,
            minY: -0.3, maxY: 0.3,
            minZ: -0.15, maxZ: 0.15
        };
    }

    activate(x, z) {
        this.active = true;
        this.position.set(x, -6, z);
        this.mesh.position.copy(this.position);
        this.mesh.visible = true;
        this.velocity.set(0, this.speed, 0);
    }

    deactivate() {
        this.active = false;
        this.mesh.visible = false;
        this.mesh.position.set(0, -100, 0); // Move off-screen
    }

    update(delta) {
        if (!this.active) return;

        // Move bullet upward
        this.position.y += this.velocity.y * delta;
        this.mesh.position.copy(this.position);

        // Deactivate if out of bounds
        if (this.position.y > 12) {
            this.deactivate();
        }
    }

    isOutOfBounds() {
        return this.position.y > 12;
    }

    getBounds() {
        return {
            minX: this.position.x + this.aabb.minX,
            maxX: this.position.x + this.aabb.maxX,
            minY: this.position.y + this.aabb.minY,
            maxY: this.position.y + this.aabb.maxY,
            minZ: this.position.z + this.aabb.minZ,
            maxZ: this.position.z + this.aabb.maxZ
        };
    }

    dispose() {
        // Geometry is pooled, material is shared - no disposal needed
        this.deactivate();
    }
}
