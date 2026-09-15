import * as THREE from 'three';
import { ObjectPool } from '../../../shared/pool/ObjectPool.js';
import { ParticleManager } from '../../../shared/particles/ParticleManager.js';
import { vec3Distance, lerpColor } from '../../../shared/math/MathUtils.js';

const BLOCK_GEOMETRY = new THREE.BoxGeometry(0.4, 0.3, 0.4);

export class BarrierBlock {
    constructor(scene, position) {
        this.hp = 3;
        this.alive = true;
        this.mesh = null;
        this.position = position.clone();
        this._createMesh(scene);
    }

    _createMesh(scene) {
        const material = new THREE.MeshStandardMaterial({
            color: 0x22aa44,
            emissive: 0x115522,
            emissiveIntensity: 0.3,
            roughness: 0.6,
            metalness: 0.3,
        });

        this.mesh = new THREE.Mesh(BLOCK_GEOMETRY, material);
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
    }

    takeDamage() {
        if (!this.alive) return false;
        this.hp -= 1;
        if (this.hp <= 0) {
            this.alive = false;
            this.mesh.visible = false;
            return true;
        }
        const intensity = Math.max(0.3, this.hp / 3);
        this.mesh.material.emissiveIntensity = intensity * 0.5;
        this.mesh.material.color.setHex(MathUtils.lerpColor(0x22aa44, 0x884411, 1 - this.hp / 3));
        return false;
    }

    destroy() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
    }
}

export class Barrier {
    constructor(scene, positionX, config) {
        this.scene = scene;
        this.positionX = positionX;
        this.config = config;
        this.blocks = [];
        this._buildBarrier();
    }

    _buildBarrier() {
        const cols = 8;
        const rows = 6;
        const spacingX = 0.45;
        const spacingY = 0.35;
        const startX = -((cols - 1) * spacingX) / 2;
        const startY = (rows - 1) * spacingY / 2;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Create an arch shape by removing bottom-center blocks
                if (row === 0 && col >= 3 && col <= 4) continue;

                const x = this.positionX + startX + col * spacingX;
                const y = -1.5 + startY - row * spacingY;
                const z = 0;
                const block = new BarrierBlock(this.scene, new THREE.Vector3(x, y, z));
                this.blocks.push(block);
            }
        }
    }

    takeDamage(position, projectileColor) {
        const destroyedBlocks = [];
        let closestDist = Infinity;
        let closestBlock = null;

        for (const block of this.blocks) {
            if (!block.alive) continue;
            const dist = MathUtils.vec3Distance(block.position, position);
            if (dist < 0.4 && dist < closestDist) {
                closestDist = dist;
                closestBlock = block;
            }
        }

        if (closestBlock) {
            const wasAlive = closestBlock.takeDamage();
            if (!closestBlock.alive) {
                destroyedBlocks.push(closestBlock);
            }
        }

        return destroyedBlocks;
    }

    isFullyDestroyed() {
        for (const block of this.blocks) {
            if (block.alive) return false;
        }
        return true;
    }

    destroy() {
        for (const block of this.blocks) {
            block.destroy();
        }
        this.blocks.length = 0;
    }

    getBlocks() {
        return this.blocks;
    }
}
