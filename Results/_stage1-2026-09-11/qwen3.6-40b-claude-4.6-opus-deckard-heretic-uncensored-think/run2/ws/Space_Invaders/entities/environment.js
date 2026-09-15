import * as THREE from 'three';
import { clamp } from '../shared/mathUtils.js';

// Environment manager for space background and atmospheric effects
export class EnvironmentManager {
    constructor(scene) {
        this.scene = scene;
        this.stars = [];
        this.nebulae = [];
        this.time = 0;
        
        // Generate star field
        this.generateStarField();
        
        // Create nebula effects
        this.createNebulae();
    }

    generateStarField() {
        const starCount = 2000;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const sizes = [];
        const colors = [];
        
        for (let i = 0; i < starCount; i++) {
            // Distribute stars in a sphere around the scene
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(1 - 2 * Math.random());
            
            const radius = 50 + Math.random() * 100;
            positions.push(radius * Math.sin(phi) * Math.cos(theta));
            positions.push(radius * Math.sin(phi) * Math.sin(theta));
            positions.push(radius * Math.cos(phi));
            
            sizes.push(Math.random() * 2 + 0.5);
            
            // Star colors - mostly white with some blue and red stars
            const colorType = Math.random();
            if (colorType < 0.7) {
                // White/blue stars
                colors.push(1, 1, 1);
            } else if (colorType < 0.9) {
                // Blue stars
                colors.push(0.6, 0.8, 1);
            } else {
                // Red stars
                colors.push(1, 0.7, 0.5);
            }
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 1,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });
        
        this.starField = new THREE.Points(geometry, material);
        this.scene.add(this.starField);
    }

    createNebulae() {
        // Create procedural nebula clouds using large translucent spheres
        for (let i = 0; i < 5; i++) {
            const geometry = new THREE.SphereGeometry(15 + Math.random() * 20, 32, 32);
            
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(
                    Math.random() * 0.3 + 0.1,
                    Math.random() * 0.3 + 0.2,
                    Math.random() * 0.5 + 0.3
                ),
                transparent: true,
                opacity: 0.05 + Math.random() * 0.1,
                emissive: new THREE.Color(
                    Math.random() * 0.1,
                    Math.random() * 0.1,
                    Math.random() * 0.2
                ),
                side: THREE.DoubleSide
            });
            
            const nebula = new THREE.Mesh(geometry, material);
            nebula.position.set(
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * 60,
                -30 + Math.random() * 40
            );
            
            this.scene.add(nebula);
            this.nebulae.push({ mesh: nebula, speed: Math.random() * 0.01 });
        }
    }

    update(dt) {
        this.time += dt;
        
        // Slowly rotate star field for parallax effect
        if (this.starField) {
            this.starField.rotation.y += 0.001 * dt;
        }
        
        // Animate nebulae movement and pulsing
        this.nebulae.forEach(nebula => {
            nebula.mesh.position.x += nebula.speed * 0.5;
            
            // Pulse opacity for atmospheric effect
            const pulse = Math.sin(this.time * 0.1) * 0.02;
            nebula.mesh.material.opacity = clamp(
                nebula.mesh.material.opacity + pulse, 
                0.03, 0.15
            );
        });
    }

    dispose() {
        if (this.starField) {
            this.starField.geometry.dispose();
            this.starField.material.dispose();
        }
        
        this.nebulae.forEach(nebula => {
            nebula.mesh.geometry.dispose();
            nebula.mesh.material.dispose();
        });
    }
}

// Atmospheric effects system for visual enhancement
export class AtmosphericEffects {
    constructor(scene) {
        this.scene = scene;
        this.lensFlare = null;
        
        // Initialize lens flare effect
        this.createLensFlare();
    }

    createLensFlare() {
        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.15,
            emissive: new THREE.Color(0.3, 0.3, 0.5),
            side: THREE.DoubleSide
        });

        this.lensFlare = new THREE.Mesh(geometry, material);
        this.lensFlare.scale.set(0.1, 0.1, 0.1); // Start small
        
        scene.add(this.lensFlare);
    }

    update(dt) {
        if (this.lensFlare) {
            // Pulse the lens flare effect
            const pulse = Math.sin(Date.now() * 0.002) * 0.1;
            this.lensFlare.material.opacity = clamp(
                this.lensFlare.material.opacity + pulse, 
                0.05, 0.3
            );
        }
    }

    dispose() {
        if (this.lensFlare) {
            this.lensFlare.geometry.dispose();
            this.lensFlare.material.dispose();
        }
    }
}

