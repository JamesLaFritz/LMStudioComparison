import * as THREE from 'three';
import { createNeonGlowMaterial } from '../../shared/rendering/MaterialFactory.js';

const PROJECTILE_HEIGHT = 0.6;
const PROJECTILE_RADIUS = 0.04;

export class Projectile {
    constructor() {
        this.mesh = null;
        this.velocity = new THREE.Vector3();
        this.isPlayerProjectile = true;
        this.active = false;
        this.ownerId = null;
        this.damage = 1;
        this._geometry = null;
        this._material = null;
    }

    init(isPlayerProjectile, color = 0x00ffff) {
        if (this.mesh) {
            this.dispose();
        }

        this.isPlayerProjectile = isPlayerProjectile;
        this.active = true;
        this.velocity.set(0, 0, 0);

        const emissiveColor = new THREE.Color(color);
        this._material = createNeonGlowMaterial(emissiveColor, 2.0);
        this._geometry = new THREE.CylinderGeometry(PROJECTILE_RADIUS, PROJECTILE_RADIUS, PROJECTILE_HEIGHT, 8);
        this._geometry.rotateX(Math.PI / 2);

        this.mesh = new THREE.Mesh(this._geometry, this._material);
        this.mesh.visible = false;

        const lightColor = color;
        const intensity = isPlayerProjectile ? 1.5 : 0.8;
        this._light = new THREE.PointLight(lightColor, intensity, isPlayerProjectile ? 4 : 3);
        this.mesh.add(this._light);
    }

    spawn(position, isPlayerProjectile, color) {
        this.init(isPlayerProjectile, color);
        this.mesh.position.copy(position);
        this.mesh.visible = true;

        if (isPlayerProjectile) {
            this.velocity.set(0, 0, -12);
        } else {
            this.velocity.set(0, 0, 8 + Math.random() * 3);
        }
    }

    update(deltaTime) {
        if (!this.active || !this.mesh.visible) return;

        this.mesh.position.x += this.velocity.x * deltaTime;
        this.mesh.position.y += this.velocity.y * deltaTime;
        this.mesh.position.z += this.velocity.z * deltaTime;

        const limitZ = this.isPlayerProjectile ? -60 : 25;
        if (this.mesh.position.z < limitZ || this.mesh.position.z > limitZ) {
            this.deactivate();
        }
    }

    getAABB() {
        if (!this.active || !this.mesh.visible) return null;
        const pos = this.mesh.position;
        return {
            minX: pos.x - PROJECTILE_RADIUS,
            maxX: pos.x + PROJECTILE_RADIUS,
            minY: pos.y - PROJECTILE_RADIUS,
            maxY: pos.y + PROJECTILE_RADIUS,
            minZ: pos.z - PROJECTILE_HEIGHT / 2,
            maxZ: pos.z + PROJECTILE_HEIGHT / 2
        };
    }

    deactivate() {
        this.active = false;
        if (this.mesh) {
            this.mesh.visible = false;
        }
    }

    dispose() {
        if (this._geometry) {
            this._geometry.dispose();
            this._geometry = null;
        }
        if (this._material) {
            this._material.dispose();
            this._material = null;
        }
        if (this.mesh && this._light) {
            this.mesh.remove(this._light);
        }
        if (this._light) {
            this._light.dispose();
            this._light = null;
        }
        this.mesh = null;
    }
}
