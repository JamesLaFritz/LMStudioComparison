import * as THREE from 'three';

const isTexture = (value) => value instanceof THREE.Texture;

export class ResourceTracker {
  constructor() {
    this.resources = new Set();
    this.disposed = false;
  }

  track(resource) {
    if (!resource || this.disposed) return resource;
    this.resources.add(resource);

    if (resource instanceof THREE.Object3D) {
      resource.traverse((object) => {
        this.resources.add(object);
        if (object.geometry) this.resources.add(object.geometry);
        if (Array.isArray(object.material)) object.material.forEach((material) => this._trackMaterial(material));
        else if (object.material) this._trackMaterial(object.material);
      });
    } else if (resource instanceof THREE.Material) {
      this._trackMaterial(resource);
    }
    return resource;
  }

  _trackMaterial(material) {
    this.resources.add(material);
    for (const value of Object.values(material)) {
      if (isTexture(value)) this.resources.add(value);
    }
  }

  untrack(resource) {
    this.resources.delete(resource);
    return resource;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const resource of this.resources) {
      if (resource instanceof THREE.Object3D && resource.parent) resource.parent.remove(resource);
    }
    for (const resource of this.resources) {
      if (typeof resource.dispose === 'function') resource.dispose();
    }
    this.resources.clear();
  }
}
