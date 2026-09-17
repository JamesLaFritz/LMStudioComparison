// Explicit GPU-resource ownership. Anything tracked here is disposed exactly once on `dispose()`:
// geometries, materials (and every texture they reference), textures, render targets, and whole
// Object3D subtrees (removed from their parent as well).

function disposeMaterial(material) {
  for (const key in material) {
    const value = material[key];
    if (value && typeof value === 'object' && value.isTexture) value.dispose();
  }
  material.dispose();
}

/** Dispose an Object3D subtree's geometries/materials/textures and detach it from its parent. */
export function disposeObject3D(object) {
  object.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      if (Array.isArray(node.material)) node.material.forEach(disposeMaterial);
      else disposeMaterial(node.material);
    }
    if (node.isInstancedMesh) node.dispose();
  });
  object.removeFromParent();
}

export class ResourceTracker {
  constructor() {
    this._resources = new Set();
  }

  get size() {
    return this._resources.size;
  }

  /** Track a resource (or array of resources) and return it for inline use. */
  track(resource) {
    if (!resource) return resource;
    if (Array.isArray(resource)) {
      for (const r of resource) this.track(r);
      return resource;
    }
    if (resource.isObject3D) {
      this._resources.add(resource);
      resource.traverse((node) => {
        if (node.geometry) this._resources.add(node.geometry);
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          for (const m of mats) {
            this._resources.add(m);
            for (const key in m) {
              const v = m[key];
              if (v && typeof v === 'object' && v.isTexture) this._resources.add(v);
            }
          }
        }
      });
      return resource;
    }
    if (typeof resource.dispose === 'function') {
      this._resources.add(resource);
      if (resource.isMaterial) {
        for (const key in resource) {
          const v = resource[key];
          if (v && typeof v === 'object' && v.isTexture) this._resources.add(v);
        }
      }
    }
    return resource;
  }

  untrack(resource) {
    this._resources.delete(resource);
  }

  /** Dispose everything tracked. Object3Ds are detached from the scene graph. */
  dispose() {
    for (const res of this._resources) {
      if (res.isObject3D) {
        res.removeFromParent();
        if (res.isInstancedMesh) res.dispose();
      } else if (typeof res.dispose === 'function') {
        res.dispose();
      }
    }
    this._resources.clear();
  }
}
