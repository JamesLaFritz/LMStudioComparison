import * as THREE from 'three';
import { MathUtils } from '../../shared/math/MathUtils.js';

/**
 * World class handles the procedural generation of the environment,
 * including the starfield and any static background elements.
 */
export class World {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.starfield = null;
        this.starsCount = 2000;
    }

    /**
     * Generates the procedural starfield using BufferGeometry and points.
     */
    createStarfield() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.starsCount * 3);
        const colors = new Float32Array(this.starsCount * 3);

        for (let i = 0; i < this.starsCount; i++) {
            // Spread stars in a large volume around the center
            positions[i * 3] = (Math.random() - 0.5) * 200;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 200;

            // Random neon-ish colors for stars
            colors[i * 3] = Math.random();     // R
            colors[i * 3 + 1] = Math.random(); // G
            colors[i * 3 + 2] = Math.random(); // B
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        this.starfield = new THREE.Points(geometry, material);
        this.scene.add(this.starfield);
    }

    /**
     * Updates the starfield parallax effect based on camera movement.
     * @param {THREE.Camera} camera 
     */
    update(camera) {
        if (!this.starfield) return;

        // Subtle parallax: move stars slightly in opposition to camera movement
        // This is a very basic implementation of parallax
        const targetRotation = new THREE.Euler(0, 0, 0);
        this.starfield.rotation.x += (targetRotation.x - this.starfield.rotation.x) * 0.05;
        this.starfield.rotation.y += (targetRotation.y - this.starfield.rotation.y) * 0.05;
    }

    /**
     * Cleans up resources.
     */
    dispose() {
        if (this.starfield) {
            this.starfield.geometry.dispose();
            this.starfield.material.dispose();
            this.scene.remove(this.starfield);
        }
    }
}
