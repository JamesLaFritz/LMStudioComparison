/**
 * ShockwaveRings System
 * Expanding emissive rings spawned at impact/explosion locations
 */

import * as THREE from 'three';

class ShockwaveRing {
    constructor(position, color = 0x00ffff, maxRadius = 8) {
        this.position = position.clone();
        this.color = color;
        this.maxRadius = maxRadius;
        this.currentRadius = 0.3;
        this.expansionRate = 0.4;
        this.opacity = 1.0;
        this.active = true;

        // Create torus geometry for the ring
        const geometry = new THREE.TorusGeometry(0.5, 0.08, 8, 24);
        
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 3,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.rotation.x = Math.PI / 2; // Lay flat on ground plane
        
        this.geometry = geometry;
        this.material = material;
    }

    update(delta) {
        if (!this.active) return false;

        // Expand the ring
        const scale = this.currentRadius / 0.5;
        this.mesh.scale.set(scale, scale, scale);
        
        // Fade out as it expands
        this.opacity -= delta * 1.2;
        this.material.opacity = Math.max(0, this.opacity);
        this.material.emissiveIntensity = 3 * this.opacity;

        // Stop when fully faded or reached max radius
        if (this.opacity <= 0.01 || this.currentRadius >= this.maxRadius) {
            this.active = false;
            return false;
        }

        return true;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
        this.mesh = null;
        this.geometry = null;
        this.material = null;
    }
}

class ShockwaveRingManager {
    constructor(scene) {
        this.scene = scene;
        this.rings = [];
        this.maxRings = 15; // Limit concurrent rings
    }

    spawn(position, color = 0x00ffff, maxRadius = 8) {
        // If at capacity, remove oldest ring
        if (this.rings.length >= this.maxRings) {
            const oldRing = this.rings.shift();
            oldRing.dispose();
            this.scene.remove(oldRing.mesh);
        }

        const ring = new ShockwaveRing(position, color, maxRadius);
        this.scene.add(ring.mesh);
        this.rings.push(ring);
        
        return ring;
    }

    update(delta) {
        // Update all rings and remove inactive ones
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const ring = this.rings[i];
            if (!ring.update(delta)) {
                ring.dispose();
                this.scene.remove(ring.mesh);
                this.rings.splice(i, 1);
            }
        }
    }

    clear() {
        for (const ring of this.rings) {
            ring.dispose();
            this.scene.remove(ring.mesh);
        }
        this.rings = [];
    }
}

// Export the manager class as ShockwaveRings for convenience
export const ShockwaveRings = ShockwaveRingManager;
export default ShockwaveRingManager;
export { ShockwaveRing, ShockwaveRingManager };
