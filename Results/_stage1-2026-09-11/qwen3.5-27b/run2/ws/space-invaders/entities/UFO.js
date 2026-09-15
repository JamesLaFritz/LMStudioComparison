import * as THREE from 'three';
import { PBRMaterialFactory } from '../../shared/rendering/PBRMaterialFactory.js';

export class UFO {
    constructor(scene, particleManager, floatingTextPool) {
        this.scene = scene;
        this.particleManager = particleManager;
        this.floatingTextPool = floatingTextPool;
        
        this.activeUFO = false;
        this.spawnTimer = 0;
        this.minSpawnTime = 15; // seconds between UFO spawns
        this.maxSpawnTime = 35;
        
        this.ufoMesh = null;
        this.ufoDirection = 1;
        this.ufoSpeed = 4;
        this.ufoPoints = 0;
    }

    update(delta) {
        if (this.activeUFO && this.ufoMesh) {
            return this.updateActiveUFO(delta);
        }
        
        // Count down to next spawn
        this.spawnTimer -= delta;
        
        // Random chance to spawn when timer expires
        if (this.spawnTimer <= 0 && Math.random() < 0.3) {
            this.spawn();
        }
    }

    updateActiveUFO(delta) {
        const pos = this.ufoMesh.position;
        pos.x += this.ufoDirection * this.ufoSpeed * delta;

        // Check if off screen
        if ((this.ufoDirection === 1 && pos.x < -20) ||
            (this.ufoDirection === -1 && pos.x > 20)) {
            this.deactivateUFO();
            return null;
        }

        return this.ufoMesh;
    }

    spawn() {
        if (this.activeUFO) return null;

        // Create UFO mesh
        const topGeometry = new THREE.CylinderGeometry(0.8, 1.2, 0.3, 16);
        const bottomGeometry = new THREE.CylinderGeometry(1.2, 0.8, 0.2, 16);

        this.ufoMaterial = PBRMaterialFactory.createNeonMaterial(0x00ff88, 3);

        const topMesh = new THREE.Mesh(topGeometry, this.ufoMaterial.clone());
        const bottomMesh = new THREE.Mesh(bottomGeometry, this.ufoMaterial.clone());
        bottomMesh.position.y = -0.25;

        // Add dome on top
        const domeGeometry = new THREE.SphereGeometry(0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMaterial = PBRMaterialFactory.createNeonMaterial(0x88ffaa, 2);
        const domeMesh = new THREE.Mesh(domeGeometry, domeMaterial);
        domeMesh.position.y = 0.3;

        // Group all meshes
        this.ufoMesh = new THREE.Group();
        this.ufoMesh.add(topMesh);
        this.ufoMesh.add(bottomMesh);
        this.ufoMesh.add(domeMesh);

        // Position at top of screen, random side
        this.ufoDirection = Math.random() > 0.5 ? -1 : 1;
        this.ufoMesh.position.set(
            this.ufoDirection * 20,
            6,
            0
        );
        this.ufoMesh.userData.direction = this.ufoDirection;

        // Determine points based on direction
        const directions = [100, 200, 300];
        this.ufoPoints = directions[Math.floor(Math.random() * directions.length)];

        this.scene.add(this.ufoMesh);
        this.activeUFO = true;

        // Reset spawn timer for next UFO
        this.spawnTimer = this.minSpawnTime + Math.random() * (this.maxSpawnTime - this.minSpawnTime);

        return this.ufoMesh;
    }

    deactivateUFO() {
        if (!this.ufoMesh) return;

        this.scene.remove(this.ufoMesh);

        // Dispose geometries and materials
        const children = [...this.ufoMesh.children];
        children.forEach(child => {
            child.geometry.dispose();
            child.material.dispose();
        });

        this.ufoMesh = null;
        this.activeUFO = false;
    }

    destroy() {
        if (!this.ufoMesh) return;

        // Spawn explosion particles
        const pos = this.ufoMesh.position.clone();
        this.particleManager.spawnExplosion(pos, 60);

        // Add floating text for points
        this.floatingTextPool.spawn(`+${this.ufoPoints}`, pos, 0xff00ff, 32);

        this.deactivateUFO();
    }

    getMesh() {
        return this.ufoMesh;
    }

    getPosition() {
        return this.ufoMesh ? this.ufoMesh.position.clone() : null;
    }

    isActive() {
        return this.activeUFO && this.ufoMesh !== null;
    }

    getScoreValue() {
        return this.ufoPoints;
    }

    resetTimer() {
        this.spawnTimer = this.minSpawnTime + Math.random() * (this.maxSpawnTime - this.minSpawnTime);
    }
}

export default UFO;
