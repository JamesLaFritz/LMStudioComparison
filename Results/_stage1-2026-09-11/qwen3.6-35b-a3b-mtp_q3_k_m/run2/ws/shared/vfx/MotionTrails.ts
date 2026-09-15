import * as THREE from 'three';

export interface TrailSegment {
    position: THREE.Vector3;
    opacity: number;
}

export class MotionTrail {
    private positions: TrailSegment[] = [];
    private maxSegments: number;
    private mesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> | null = null;
    private dummy = new THREE.Object3D();
    private tempColor = new THREE.Color();

    constructor(maxSegments: number) {
        this.maxSegments = maxSegments;
    }

    public addPosition(pos: THREE.Vector3): void {
        const seg: TrailSegment = { position: pos.clone(), opacity: 1.0 };
        this.positions.push(seg);
        if (this.positions.length > this.maxSegments) {
            this.positions.shift();
        }
    }

    public updateMesh(scene: THREE.Scene, material: THREE.MeshBasicMaterial): void {
        const count = this.positions.length;
        if (count === 0) {
            if (this.mesh !== null) {
                scene.remove(this.mesh);
                this.mesh.dispose();
                this.mesh = null;
            }
            return;
        }

        const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        if (this.mesh === null) {
            this.mesh = new THREE.InstancedMesh(geo, material, this.maxSegments);
            scene.add(this.mesh);
        } else {
            // Reuse existing mesh geometry but update count
            this.mesh.count = count;
        }

        for (let i = 0; i < count; i++) {
            const seg = this.positions[i];
            const t = i / count;
            this.dummy.position.copy(seg.position);
            this.dummy.scale.setScalar(t * 0.8 + 0.2);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);

            // Fade from full opacity to transparent
            const alpha = t;
            material.color.setRGB(1, 1, 1);
            (material as THREE.MeshBasicMaterial).opacity = alpha * 0.6;
            this.mesh.setColorAt(i, new THREE.Color().setHSL(0.5 + t * 0.2, 1, 0.5));
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) {
            this.mesh.instanceColor.needsUpdate = true;
        }
    }

    public clear(): void {
        this.positions.length = 0;
    }

    public dispose(): void {
        this.clear();
        if (this.mesh !== null) {
            this.mesh.geometry.dispose();
            // Material is shared, don't dispose it here
            this.mesh = null;
        }
    }
}
