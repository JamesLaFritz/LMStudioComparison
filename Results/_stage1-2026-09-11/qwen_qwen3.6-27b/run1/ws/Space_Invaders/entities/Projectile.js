import * as THREE from 'three';
import { ObjectPool } from '../../shared/core/ObjectPool.js';
import { createStandardMaterial } from '../../shared/graphics/ProceduralAssets.js';

const BULLET_SPEED = 40;
const ALIEN_BULLET_SPEED = 18;
const BULLET_RADIUS = 0.25;

function createPlayerBullet() {
    const geo = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 6);
    const mat = createStandardMaterial(0x00ffff, 0.2, 0.8, 0x00ffff, 2.0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    return { mesh, speed: BULLET_SPEED, owner: 'player', alive: false };
}

function createAlienBullet() {
    const geo = new THREE.CylinderGeometry(0.06, 0.1, 0.6, 5);
    const mat = createStandardMaterial(0xff3366, 0.2, 0.8, 0xff3366, 2.0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    return { mesh, speed: ALIEN_BULLET_SPEED, owner: 'alien', alive: false };
}

export class ProjectileManager {
    constructor() {
        this._playerPool = new ObjectPool(createPlayerBullet, (b) => {
            b.alive = false;
            b.mesh.visible = false;
        }, 120);
        this._alienPool = new ObjectPool(createAlienBullet, (b) => {
            b.alive = false;
            b.mesh.visible = false;
        }, 120);
        this._bullets = [];
        this._halfH = 12;
    }

    setBounds(halfH) { this._halfH = halfH; }

    spawnPlayerBullet(x, y) {
        const b = this._playerPool.acquire();
        if (!b) return null;
        b.alive = true;
        b.mesh.position.set(x, y, 0);
        b.mesh.visible = true;
        this._bullets.push(b);
        return b;
    }

    spawnAlienBullet(x, y) {
        const b = this._alienPool.acquire();
        if (!b) return null;
        b.alive = true;
        b.mesh.position.set(x, y, 0);
        b.mesh.visible = true;
        this._bullets.push(b);
        return b;
    }

    update(dt) {
        for (let i = this._bullets.length - 1; i >= 0; i--) {
            const b = this._bullets[i];
            if (!b.alive) continue;
            const dir = b.owner === 'player' ? 1 : -1;
            b.mesh.position.y += b.speed * dir * dt;
            if (b.mesh.position.y > this._halfH || b.mesh.position.y < -this._halfH) {
                this.release(b);
                this._bullets.splice(i, 1);
            }
        }
    }

    getAlive() {
        return this._bullets.filter(b => b.alive);
    }

    release(b) {
        b.alive = false;
        b.mesh.visible = false;
        const pool = b.owner === 'player' ? this._playerPool : this._alienPool;
        pool.release(b);
    }

    destroy() {
        for (const b of this._bullets) {
            b.mesh.geometry.dispose();
            b.mesh.material.dispose();
            const pool = b.owner === 'player' ? this._playerPool : this._alienPool;
            pool.release(b);
        }
        this._bullets.length = 0;
    }
}
