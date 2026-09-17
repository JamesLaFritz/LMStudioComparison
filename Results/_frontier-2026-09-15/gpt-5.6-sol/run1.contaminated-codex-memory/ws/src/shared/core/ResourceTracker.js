import { Object3D } from 'three';

function isObject3D(value) {
  return value instanceof Object3D || value?.isObject3D === true;
}

function visitObjectResources(root, visitor) {
  root.traverse((object) => {
    visitor(object);
    if (object.geometry) visitor(object.geometry);
    if (Array.isArray(object.material)) {
      for (const material of object.material) visitor(material);
    } else if (object.material) {
      visitor(object.material);
    }
  });
}

/** Set-backed ownership registry for scene GPU resources and Object3D nodes. */
export class ResourceTracker {
  constructor() {
    this._resources = new Set();
    this._disposed = false;
  }

  get size() {
    return this._resources.size;
  }

  track(resource) {
    if (resource === null || resource === undefined) return resource;
    if (this._disposed) throw new Error('Cannot track resources after ResourceTracker.dispose()');
    if (Array.isArray(resource)) {
      for (const entry of resource) this.track(entry);
      return resource;
    }
    if ((typeof resource !== 'object' && typeof resource !== 'function')) {
      throw new TypeError('Tracked resource must be an object');
    }

    if (isObject3D(resource)) {
      visitObjectResources(resource, (entry) => this._resources.add(entry));
    } else {
      // WebGLRenderTarget is deliberately tracked as one owner. Its `.texture`
      // is not recursively added, preventing double disposal of PMREM targets.
      this._resources.add(resource);
    }
    return resource;
  }

  untrack(resource) {
    if (resource === null || resource === undefined) return resource;
    if (Array.isArray(resource)) {
      for (const entry of resource) this.untrack(entry);
      return resource;
    }
    if (isObject3D(resource)) {
      visitObjectResources(resource, (entry) => this._resources.delete(entry));
    } else {
      this._resources.delete(resource);
    }
    return resource;
  }

  /**
   * Release renderer-owned GPU bindings while a WebGL context is lost without
   * giving up ownership of the reusable CPU-side resources.
   *
   * Three.js installs renderer-specific `dispose` listeners the first time a
   * geometry, material, texture, render target, or InstancedMesh is rendered.
   * A restored WebGLRenderer installs a fresh set of managers, so those old
   * listeners must be allowed to detach while the old context is still lost.
   * The resources themselves remain valid and are uploaded again on the first
   * restored render; the tracker will still dispose them normally at teardown.
   */
  releaseGpuResourcesForContextLoss() {
    if (this._disposed) return 0;
    let released = 0;
    for (const resource of this._resources) {
      if (typeof resource.dispose !== 'function') continue;
      resource.dispose();
      released += 1;
    }
    return released;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    for (const resource of this._resources) {
      if (isObject3D(resource) && resource.parent) resource.parent.remove(resource);
    }
    for (const resource of this._resources) {
      // InstancedMesh is an Object3D and also owns disposable instance buffers.
      // Ordinary Object3D subclasses simply do not expose dispose().
      if (typeof resource.dispose === 'function') resource.dispose();
    }
    this._resources.clear();
  }
}
