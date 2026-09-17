/**
 * Owns WebGL, DOM, and listener resources created by one mounted game session.
 * Tracking is deliberately explicit: a renderer can be destroyed without
 * guessing which game objects it owns.
 */
const MATERIAL_TEXTURE_KEYS = [
  'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap',
  'envMap', 'lightMap', 'metalnessMap', 'normalMap', 'roughnessMap',
  'specularMap', 'transmissionMap',
];

export class ResourceRegistry {
  constructor(label = 'game-session') {
    this.label = label;
    this._resources = new Set();
    this._objects = new Set();
    this._nodes = new Set();
    this._cleanups = [];
    this._disposed = new WeakSet();
    this.isDisposed = false;
  }

  track(resource) {
    if (resource && typeof resource === 'object') this._resources.add(resource);
    return resource;
  }

  trackObject(object3d) {
    if (object3d && typeof object3d === 'object') this._objects.add(object3d);
    return object3d;
  }

  trackDom(node) {
    if (node && typeof node === 'object') this._nodes.add(node);
    return node;
  }

  trackEvent(target, type, listener, options) {
    if (!target?.addEventListener || !listener) return listener;
    target.addEventListener(type, listener, options);
    this._cleanups.push(() => target.removeEventListener(type, listener, options));
    return listener;
  }

  addCleanup(cleanup) {
    if (typeof cleanup === 'function') this._cleanups.push(cleanup);
    return cleanup;
  }

  untrack(resource) {
    this._resources.delete(resource);
    this._objects.delete(resource);
    this._nodes.delete(resource);
    return resource;
  }

  disposeResource(resource) {
    if (!resource || typeof resource !== 'object' || this._disposed.has(resource)) return;
    this._disposed.add(resource);

    if (resource.isObject3D) {
      resource.parent?.remove(resource);
      resource.traverse?.((child) => {
        if (child.geometry) this.disposeResource(child.geometry);
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => this.disposeResource(material));
        } else if (child.material) {
          this.disposeResource(child.material);
        }
      });
      return;
    }

    if (resource.isMaterial) {
      for (const key of MATERIAL_TEXTURE_KEYS) {
        if (resource[key]) this.disposeResource(resource[key]);
      }
    }

    if (typeof resource.dispose === 'function') resource.dispose();
  }

  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;

    for (let index = this._cleanups.length - 1; index >= 0; index -= 1) {
      try {
        this._cleanups[index]();
      } catch {
        // Teardown should continue even if an external target is already gone.
      }
    }
    this._cleanups.length = 0;

    for (const object3d of this._objects) this.disposeResource(object3d);
    this._objects.clear();

    for (const resource of this._resources) this.disposeResource(resource);
    this._resources.clear();

    for (const node of this._nodes) node.parentNode?.removeChild(node);
    this._nodes.clear();
  }

  get size() {
    return this._resources.size + this._objects.size + this._nodes.size + this._cleanups.length;
  }
}

export function disposeObject3D(object3d) {
  const registry = new ResourceRegistry('one-shot-disposal');
  registry.trackObject(object3d);
  registry.dispose();
}
