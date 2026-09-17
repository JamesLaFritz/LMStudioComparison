import * as THREE from 'three';

/**
 * Centralizes authored scene materials. Every factory method returns a
 * MeshStandardMaterial so visual objects share the same PBR lighting contract.
 */
export class MaterialFactory {
  constructor({ registry = null } = {}) {
    this.registry = registry;
    this._materials = new Set();
  }

  standard(options = {}) {
    const material = new THREE.MeshStandardMaterial({
      color: options.color ?? 0x71839c,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0,
      metalness: options.metalness ?? 0.72,
      roughness: options.roughness ?? 0.34,
      map: options.map ?? null,
      normalMap: options.normalMap ?? null,
      roughnessMap: options.roughnessMap ?? null,
      metalnessMap: options.metalnessMap ?? null,
      emissiveMap: options.emissiveMap ?? null,
      alphaMap: options.alphaMap ?? null,
      transparent: Boolean(options.transparent),
      opacity: options.opacity ?? 1,
      depthWrite: options.depthWrite ?? true,
      side: options.side ?? THREE.FrontSide,
      vertexColors: Boolean(options.vertexColors),
      flatShading: Boolean(options.flatShading),
    });
    material.name = options.name ?? 'pbr-standard';
    this._materials.add(material);
    this.registry?.track(material);
    return material;
  }

  alloy(options = {}) {
    return this.standard({
      color: 0x50647b,
      metalness: 0.9,
      roughness: 0.27,
      ...options,
    });
  }

  neon(options = {}) {
    const color = options.color ?? 0x4cf5ff;
    return this.standard({
      color,
      emissive: options.emissive ?? color,
      emissiveIntensity: options.emissiveIntensity ?? 1.8,
      metalness: options.metalness ?? 0.48,
      roughness: options.roughness ?? 0.22,
      ...options,
    });
  }

  dispose() {
    for (const material of this._materials) material.dispose();
    this._materials.clear();
  }
}

export function createMaterialFactory(options = {}) {
  return new MaterialFactory(options);
}

export function createStandardMaterial(options = {}, registry = options.registry ?? null) {
  const factory = new MaterialFactory({ registry });
  return factory.standard(options);
}
