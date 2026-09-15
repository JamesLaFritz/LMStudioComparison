import * as THREE from 'three';
import { ObjectPool } from '../../shared/core/ObjectPool.js';
import { createStandardMaterial, createEmissiveMaterial } from '../../shared/graphics/ProceduralAssets.js';

const UFO_SPAWN_INTERVAL_MIN = 15;
const UFO_SPAWN_INTERVAL_MAX = 30;
const UFO_SPEED = 4;
const UFO_Y = 12;
const UFO_POINTS = [50, 100, 150, 300];

export class UFO {
    constructor(scene, onScore, onDeath) {
        this.scene = scene;
        this.onScore = onScore;
        this.onDeath = onDeath;
        this.mesh = null;
        this.active = false;
        this.direction = 1;
        this.spawnTimer = 0;
        this.nextSpawn = this._randomInterval();
        this.points = UFO_POINTS[Math.floor(Math.random() * UFO_POINTS.length)];

        const geo = new THREE.CylinderGeometry(0.6, 0.9, 0.3, 12);
        const mat = createEmissiveMaterial(0xff2222, 2);
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.visible = false;
        this.mesh.position.set(0, UFO_Y, 0);
        this.scene.add(this.mesh);

        // Dome on top
        const domeGeo = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = createEmissiveMaterial(0xff4444, 1.5);
        this.dome = new THREE.Mesh(domeGeo, domeMat);
        this.dome.position.y = 0.15;
        this.mesh.add(this.dome);

        // Glow ring
        const ringGeo = new THREE.TorusGeometry(0.8, 0.05, 8, 24);
        const ringMat = createEmissiveMaterial(0xff0000, 3);
        this.ring = new THREE.Mesh(ringGeo, ringMat);
        this.ring.rotation.x = Math.PI / 2;
        this.mesh.add(this.ring);

        this._geo = geo;
        this._domeGeo = domeGeo;
        this._ringGeo = ringGeo;
        this._mat = mat;
        this._domeMat = domeMat;
        this._ringMat = ringMat;
    }

    _randomInterval() {
        return UFO_SPAWN_INTERVAL_MIN + Math.random() * (UFO_SPAWN_INTERVAL_MAX - UFO_SPAWN_INTERVAL_MIN);
    }

    update(dt, playerProjectiles, onHit) {
        if (!this.active) {
            this.spawnTimer += dt;
            if (this.spawnTimer >= this.nextSpawn) {
                this._spawn();
            }
            return;
        }

        // Move horizontally
        this.mesh.position.x += this.direction * UFO_SPEED * dt;

        // Rotate dome
        this.dome.rotation.y += 3 * dt;

        // Oscillate ring
        this.ring.scale.setScalar(1 + Math.sin(performance.now() * 0.01) * 0.1);

        // Check if off-screen
        if (Math.abs(this.mesh.position.x) > 14) {
            this._despawn();
        }

        // Check collision with player projectiles
        for (let i = playerProjectiles.length - 1; i >= 0; i--) {
            const proj = playerProjectiles[i];
            if (!proj.alive) continue;
            const dx = proj.mesh.position.x - this.mesh.position.x;
            const dy = proj.mesh.position.y - this.mesh.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1.2) {
                this._destroy(proj, onHit);
                return;
            }
        }
    }

    _spawn() {
        this.active = true;
        this.direction = Math.random() < 0.5 ? -1 : 1;
        this.mesh.position.x = this.direction > 0 ? -14 : 14;
        this.mesh.position.y = UFO_Y;
        this.mesh.visible = true;
        this.spawnTimer = 0;
        this.nextSpawn = this._randomInterval();
    }

    _despawn() {
        this.active = false;
        this.mesh.visible = false;
        this.spawnTimer = 0;
        this.nextSpawn = this._randomInterval();
    }

    _destroy(projectile, onHit) {
        this.active = false;
        this.mesh.visible = false;
        this.onScore(this.points, this.mesh.position.clone());
        if (this.onDeath) {
            this.onDeath(this.mesh.position.clone());
        }
        if (projectile && onHit) {
            onHit(projectile, 'ufo');
        }
        this.spawnTimer = 0;
        this.nextSpawn = this._randomInterval();
    }

    dispose() {
        this.scene.remove(this.mesh);
        this._geo.dispose();
        this._domeGeo.dispose();
        this._ringGeo.dispose();
        this._mat.dispose();
        this._domeMat.dispose();
        this._ringMat.dispose();
    }
}
