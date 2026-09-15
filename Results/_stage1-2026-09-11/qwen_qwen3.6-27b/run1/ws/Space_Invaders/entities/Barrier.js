import * as THREE from 'three';
import { ObjectPool } from '../../shared/core/ObjectPool.js';
import { aabbVsAabb } from '../../shared/math/Collision.js';

const CELL_SIZE = 0.4;
const SHIELD_COLS = 13;
const SHIELD_ROWS = 7;
const SHIELD_POSITIONS = [-5, -1.67, 1.67, 5];

const SHIELD_PATTERN = [
    '.XX..........XX.',
    '.XXX........XXX.',
    '.XXXX......XXXX.',
    'XXXXXXXXXX.XXXXX',
    'XXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXX',
];

export class Barrier {
    constructor(positionX) {
        this.positionX = positionX;
        this.cells = [];
        this.group = new THREE.Group();
        this._build();
    }

    _build() {
        const halfCols = SHIELD_COLS / 2;
        const halfRows = SHIELD_ROWS / 2;

        for (let row = 0; row < SHIELD_ROWS; row++) {
            for (let col = 0; col < SHIELD_COLS; col++) {
                const patternRow = SHIELD_PATTERN[row];
                if (!patternRow || patternRow[col] === '.') continue;

                const cell = {
                    active: true,
                    x: this.positionX + (col - halfCols) * CELL_SIZE,
                    y: -2 + (row - halfRows) * CELL_SIZE,
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    mesh: null,
                };

                const geo = new THREE.BoxGeometry(CELL_SIZE * 0.9, CELL_SIZE * 0.9, CELL_SIZE * 0.5);
                const mat = new THREE.MeshStandardMaterial({
                    color: 0x00ff88,
                    emissive: 0x00ff88,
                    emissiveIntensity: 0.3,
                    roughness: 0.5,
                    metalness: 0.2,
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(cell.x, cell.y, 0);
                this.group.add(mesh);
                cell.mesh = mesh;
                this.cells.push(cell);
            }
        }
    }

    checkCollision(projX, projY, projHW, projHH) {
        const pBox = { minX: projX - projHW, maxX: projX + projHW, minY: projY - projHH, maxY: projY + projHH, minZ: -0.25, maxZ: 0.25 };
        for (const cell of this.cells) {
            if (!cell.active) continue;
            const cBox = { minX: cell.x - cell.width/2, maxX: cell.x + cell.width/2, minY: cell.y - cell.height/2, maxY: cell.y + cell.height/2, minZ: -0.25, maxZ: 0.25 };
            if (aabbVsAabb(pBox, cBox).hit) {
                this.destroyCell(cell);
                return true;
            }
        }
        return false;
    }

    destroyCell(cell) {
        cell.active = false;
        if (cell.mesh) {
            this.group.remove(cell.mesh);
            cell.mesh.geometry.dispose();
            cell.mesh.material.dispose();
            cell.mesh = null;
        }
    }

    getActiveCount() {
        return this.cells.filter(c => c.active).length;
    }

    isDestroyed() {
        return this.getActiveCount() === 0;
    }

    dispose() {
        for (const cell of this.cells) {
            if (cell.mesh) {
                cell.mesh.geometry.dispose();
                cell.mesh.material.dispose();
            }
        }
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else if (child.material) {
                    child.material.dispose();
                }
            }
        });
    }
}
