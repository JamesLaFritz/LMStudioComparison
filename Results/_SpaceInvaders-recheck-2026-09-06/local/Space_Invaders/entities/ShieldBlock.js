import * as THREE from 'three';
import { MaterialFactory } from '../../shared/rendering/MaterialFactory.js';

const BLOCK_SIZE = 0.35;
const BLOCK_HP = 4;

export class ShieldBlock {
    constructor() {
        this.mesh = null;
        this.hp = BLOCK_HP;
        this.alive = true;
        this.position = new THREE.Vector3();
        this._material = null;
    }

    init(position) {
        if (this.mesh) {
            this.mesh.visible = false;
        } else {
            const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            this._material = MaterialFactory.createBasic(0x44ff88, 0.3);
            this.mesh = new THREE.Mesh(geometry, this._material);
            this.mesh.visible = false;
        }

        this.position.copy(position);
        this.mesh.position.copy(this.position);
        this.hp = BLOCK_HP;
        this.alive = true;
        this.mesh.visible = true;
    }

    updateVisual() {
        const damageRatio = 1.0 - (this.hp / BLOCK_HP);
        if (damageRatio > 0) {
            const r = THREE.MathUtils.lerp(0.27, 0.8, damageRatio);
            const g = THREE.MathUtils.lerp(1.0, 0.3, damageRatio);
            this._material.color.setRGB(r, g, 0.5);
        }

        if (damageRatio > 0.3) {
            const pos = this.mesh.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const ox = pos.getX(i);
                const oy = pos.getY(i);
                const oz = pos.getZ(i);
                const noise = Math.sin(ox * 20.0 + this.hp) * 0.015 * damageRatio;
                pos.setXYZ(i, ox + noise, oy + noise * 0.5, oz + noise);
            }
            pos.needsUpdate = true;
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.alive = false;
            this.mesh.visible = false;
        } else {
            this.updateVisual();
        }
        return !this.alive;
    }

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this._material.dispose();
            this.mesh.material = null;
            this.mesh = null;
        }
    }
}
