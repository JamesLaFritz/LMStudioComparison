/**
 * MotionTrails - Velocity-based trail rendering for fast-moving objects
 * Creates fading ribbon geometry following object trajectory
 */

import * as THREE from 'three';

class MotionTrail {
    constructor(object, options = {}) {
        this.object = object;
        this.maxPoints = options.maxPoints || 20;
        this.color = new THREE.Color(options.color || 0x00ffff);
        this.width = options.width || 0.15;
        this.fadeSpeed = options.fadeSpeed || 0.92;
        this.speedThreshold = options.speedThreshold || 30;
        
        this.positions = [];
        this.opacities = [];
        
        // Create trail geometry (LineStrip with varying opacity)
        this.trailGeometry = new THREE.BufferGeometry();
        const maxVertices = this.maxPoints * 8; // 4 vertices per segment for ribbon
        
        const positionsArray = new Float32Array(maxVertices * 3);
        const colorsArray = new Float32Array(maxVertices * 4);
        
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
        this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 4));
        
        // Set initial vertex count to 0 (will update as needed)
        this.trailGeometry.setDrawRange(0, 0);
        
        this.trailMaterial = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.trailLine = new THREE.Line(this.trailGeometry, this.trailMaterial);
        this.trailLine.frustumCulled = false;
        
        this.active = true;
    }

    update(delta) {
        if (!this.object || !this.active) return;
        
        // Only record position if object is moving fast enough
        const velocity = this.object.velocity || new THREE.Vector3();
        if (velocity.lengthSq() < this.speedThreshold * this.speedThreshold) {
            // Decay existing trail when slow
            this.decayTrail(delta);
            return;
        }
        
        // Add current position
        const pos = this.object.position.clone();
        this.positions.push(pos);
        this.opacities.push(1.0);
        
        // Remove oldest points if over capacity
        while (this.positions.length > this.maxPoints) {
            this.positions.shift();
            this.opacities.shift();
        }
        
        this.updateGeometry();
    }

    decayTrail(delta) {
        // Reduce opacity of all points when object is slow/stopped
        for (let i = 0; i < this.opacities.length; i++) {
            this.opacities[i] *= Math.pow(this.fadeSpeed, delta * 60);
        }
        
        // Remove fully faded points from front
        while (this.positions.length > 0 && this.opacities[0] < 0.02) {
            this.positions.shift();
            this.opacities.shift();
        }
        
        if (this.positions.length === 0) {
            this.trailGeometry.setDrawRange(0, 0);
        } else {
            this.updateGeometry();
        }
    }

    updateGeometry() {
        if (!this.active || this.positions.length < 2) return;
        
        const positions = [];
        const colors = [];
        const baseColor = this.color;
        
        for (let i = 0; i < this.positions.length - 1; i++) {
            const posA = this.positions[i];
            const posB = this.positions[i + 1];
            
            // Calculate direction and perpendicular offset
            const dir = new THREE.Vector3().subVectors(posB, posA).normalize();
            const perp = new THREE.Vector3(-dir.z, dir.y, dir.x).normalize();
            
            const halfWidth = this.width / 2;
            const opacityA = this.opacities[i];
            const opacityB = this.opacities[i + 1] || opacityA;
            
            // Create ribbon segment (4 vertices for quad)
            positions.push(
                posA.x - perp.x * halfWidth, posA.y - perp.y * halfWidth, posA.z - perp.z * halfWidth,
                posA.x + perp.x * halfWidth, posA.y + perp.y * halfWidth, posA.z + perp.z * halfWidth,
                posB.x + perp.x * halfWidth, posB.y + perp.y * halfWidth, posB.z + perp.z * halfWidth,
                posB.x - perp.x * halfWidth, posB.y - perp.y * halfWidth, posB.z - perp.z * halfWidth
            );
            
            // Colors with opacity
            const r = baseColor.r;
            const g = baseColor.g;
            const b = baseColor.b;
            
            colors.push(
                r, g, b, opacityA,
                r, g, b, opacityA,
                r, g, b, opacityB,
                r, g, b, opacityB
            );
        }
        
        // Update buffer attributes
        const positionAttribute = this.trailGeometry.attributes.position;
        const colorAttribute = this.trailGeometry.attributes.color;
        
        if (positionAttribute.array.length < positions.length) {
            // Expand arrays if needed
            positionAttribute.array.set(new Float32Array(positions));
            colorAttribute.array.set(new Float32Array(colors));
        } else {
            positionAttribute.array.set(positions);
            colorAttribute.array.set(colors);
        }
        
        positionAttribute.needsUpdate = true;
        colorAttribute.needsUpdate = true;
        
        const vertexCount = positions.length / 3;
        this.trailGeometry.setDrawRange(0, vertexCount);
    }

    addToScene(scene) {
        if (!scene.children.includes(this.trailLine)) {
            scene.add(this.trailLine);
        }
    }

    removeFromScene(scene) {
        if (scene && scene.children.includes(this.trailLine)) {
            scene.remove(this.trailLine);
        }
    }

    dispose() {
        this.active = false;
        this.positions = [];
        this.opacities = [];
        
        if (this.trailGeometry) {
            this.trailGeometry.dispose();
        }
        if (this.trailMaterial) {
            this.trailMaterial.dispose();
        }
    }

    setColor(color) {
        if (typeof color === 'number') {
            this.color.setHex(color);
        } else if (color instanceof THREE.Color) {
            this.color.copy(color);
        }
    }
}

/**
 * MotionTrailManager - Manages multiple motion trails efficiently
 */
class MotionTrailManager {
    constructor(scene) {
        this.scene = scene;
        this.trails = new Map(); // mesh.uuid -> MotionTrail
        this.maxTrails = 50;
    }

    addTrail(mesh, color = 0x00ffff, maxPoints = 20) {
        if (this.trails.size >= this.maxTrails) {
            // Remove oldest trail
            const firstKey = this.trails.keys().next().value;
            this.removeTrail(firstKey);
        }
        
        const trail = new MotionTrail(mesh, { color, maxPoints });
        trail.addToScene(this.scene);
        this.trails.set(mesh.uuid, trail);
        return trail;
    }

    getTrail(mesh) {
        return this.trails.get(mesh.uuid);
    }

    update(delta) {
        for (const trail of this.trails.values()) {
            trail.update(delta);
        }
    }

    removeTrail(uuid) {
        const trail = this.trails.get(uuid);
        if (trail) {
            trail.removeFromScene(this.scene);
            trail.dispose();
            this.trails.delete(uuid);
        }
    }

    clear() {
        for (const trail of this.trails.values()) {
            trail.removeFromScene(this.scene);
            trail.dispose();
        }
        this.trails.clear();
    }

    dispose() {
        this.clear();
    }
}

// Export both classes and a factory function
export { MotionTrail, MotionTrailManager };

/**
 * Factory function to create motion trail manager
 */
export function createMotionTrails(scene) {
    return new MotionTrailManager(scene);
}
