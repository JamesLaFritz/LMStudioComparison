import * as THREE from 'three';

export class MemoryManager {
    private trackedResources: Set<THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture> = new Set();

    public track(resource: THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture): void {
        this.trackedResources.add(resource);
    }

    public disposeResource(resource: THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture): void {
        if (resource instanceof THREE.Object3D) {
            resource.traverse((child) => {
                if ((child as THREE.Mesh).geometry) {
                    const geom = (child as THREE.Mesh).geometry;
                    this.disposeGeometry(geom);
                }
                if ((child as THREE.Mesh).material) {
                    const mat = (child as THREE.Mesh).material;
                    this.disposeMaterial(mat);
                }
            });
        } else if (resource instanceof THREE.Material) {
            this.disposeMaterial(resource);
        } else if (resource instanceof THREE.BufferGeometry) {
            this.disposeGeometry(resource);
        } else if (resource instanceof THREE.Texture) {
            this.disposeTexture(resource);
        }
        this.trackedResources.delete(resource);
    }

    private disposeMaterial(material: THREE.Material): void {
        material.dispose();
        const mat = material as THREE.Material & { [key: string]: any };
        for (const key in mat) {
            if (mat.hasOwnProperty(key)) {
                const value = mat[key];
                if (value instanceof THREE.Texture) {
                    this.disposeTexture(value);
                }
            }
        }
    }

    private disposeGeometry(geometry: THREE.BufferGeometry): void {
        geometry.dispose();
    }

    private disposeTexture(texture: THREE.Texture): void {
        texture.dispose();
        if (texture.map) this.disposeTexture(texture.map);
        if (texture.envMap) this.disposeTexture(texture.envMap);
        if (texture.displacementMap) this.disposeTexture(texture.displacementMap);
    }

    public disposeAll(): void {
        for (const resource of this.trackedResources) {
            this.disposeResource(resource);
        }
        this.trackedResources.clear();
    }

    public getTrackedCount(): number {
        return this.trackedResources.size;
    }
}