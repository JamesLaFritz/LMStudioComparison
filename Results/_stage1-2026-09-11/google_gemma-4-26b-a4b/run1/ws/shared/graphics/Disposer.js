import * as THREE from 'three';

/**
 * A simple utility for managing the lifecycle of Three.js objects.
 * Ensures that geometries, materials, and textures are properly disposed.
 */
export class Disposer {
    constructor() {
        this.geometries = new Set();
        this.materials = new Set();
        this/textures = new Set();
    }

    trackGeometry(geometry) {
        if (geometry) this.geometries.add(geometry);
        return geometry;
    }

    trackMaterial(material) {
        if (material) this.materials.add(material);
        return material;
    }

    trackTexture(texture) {
        if (texture) this.textures.add(texture);
        return texture;
    }

    dispose() {
        for (const geometry of this.geometries) {
            geometry.dispose();
        }
        this.geometries.clear();

        for (const material of this.materials) {
            if (Array.isArray(material)) {
                material.forEach(m => this.disposeMaterial(m));
            } else {
                this.disposeMaterial(material);
            }
        }
        this.materials.clear();

        for (const texture of this.textures) {
            texture.dispose();
        }
        this.textures.clear();
    }

    disposeMaterial(material) {
        if (material.map) material.map.dispose();
        if (material.lightMap) material.lightMap.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        material.dispose();
    }
}
