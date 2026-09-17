import * as THREE from 'three';

const DEFAULT_PARAMETERS = Object.freeze({
  color: 0x111827,
  emissive: 0x000000,
  emissiveIntensity: 0,
  metalness: 0.55,
  roughness: 0.38,
});

function assertKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('PbrFactory material keys must be non-empty strings.');
  }
}

export class PbrFactory {
  constructor({ tracker = null } = {}) {
    this.tracker = tracker;
    this.materials = new Map();
    this.ownedWithoutTracker = new Set();
    this.disposed = false;
  }

  create(key, parameters = {}) {
    this.#assertUsable();
    assertKey(key);
    if (this.materials.has(key)) {
      throw new Error(`PbrFactory already owns a material named "${key}".`);
    }

    const material = new THREE.MeshStandardMaterial({
      ...DEFAULT_PARAMETERS,
      ...parameters,
    });
    material.name = key;

    if (parameters.vertexColors === true) {
      material.vertexColors = true;
    }
    if (material.transparent) {
      material.depthWrite = parameters.depthWrite ?? false;
    }

    this.materials.set(key, material);
    if (this.tracker) {
      this.tracker.track(material);
    } else {
      this.ownedWithoutTracker.add(material);
    }
    return material;
  }

  get(key) {
    assertKey(key);
    const material = this.materials.get(key);
    if (!material) {
      throw new Error(`PbrFactory has no material named "${key}".`);
    }
    return material;
  }

  has(key) {
    return this.materials.has(key);
  }

  disposeReferences() {
    if (this.disposed) return;
    if (!this.tracker) {
      for (const material of this.ownedWithoutTracker) material.dispose();
    }
    this.ownedWithoutTracker.clear();
    this.materials.clear();
    this.disposed = true;
  }

  #assertUsable() {
    if (this.disposed) {
      throw new Error('PbrFactory cannot create materials after disposal.');
    }
  }
}

export function assertStandardSceneMaterials(root) {
  if (!root || typeof root.traverse !== 'function') {
    throw new TypeError('assertStandardSceneMaterials requires a Three.js Object3D root.');
  }

  const violations = [];
  root.traverse((object) => {
    if (!object.visible || (!object.isMesh && !object.isInstancedMesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (let index = 0; index < materials.length; index += 1) {
      const material = materials[index];
      if (!material?.isMeshStandardMaterial) {
        const objectName = object.name || object.type || '<unnamed mesh>';
        const materialName = material?.name || material?.type || '<missing material>';
        violations.push(`${objectName}[${index}]: ${materialName}`);
      }
    }
  });

  if (violations.length > 0) {
    throw new Error(
      `Visible scene meshes must use MeshStandardMaterial. Violations: ${violations.join(', ')}`,
    );
  }
  return true;
}
