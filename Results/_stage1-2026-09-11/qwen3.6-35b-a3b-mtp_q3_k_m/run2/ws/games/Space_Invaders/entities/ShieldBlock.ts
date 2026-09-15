import * as THREE from 'three';
import { generateShieldBlockTexture } from '../assets/TextureGenerator.js';

export class ShieldBlock {
    mesh: THREE.Mesh;
    active: boolean = true;
    private _material: THREE.MeshStandardMaterial;

    constructor(position: THREE.Vector3) {
        const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.4);
        this._material = new THREE.MeshStandardMaterial({
            color: 0x22cc88,
            roughness: 0.5,
            metalness: 0.1,
        });

        const texture = generateShieldBlockTexture();
        if (texture) {
            this._material.map = texture;
            this._material.needsUpdate = true;
        }

        this.mesh = new THREE.Mesh(geometry, this._material);
        this.mesh.position.copy(position);
    }

    destroy(): void {
        this.active = false;
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        this._material.dispose();
        this.mesh.geometry.dispose();
    }

    dispose(): void {
        this.destroy();
    }
}
