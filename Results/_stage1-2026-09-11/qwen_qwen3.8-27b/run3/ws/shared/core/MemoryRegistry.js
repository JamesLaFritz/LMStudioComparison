/**
 * MemoryRegistry — single source of truth for GPU resource lifetimes.
 *
 * Every geometry, material, texture, and composer pass created by a game is
 * tracked here. `disposeAll()` guarantees zero live GPU resources on teardown,
 * even if an individual owner forgot to clean up.
 */
export default class MemoryRegistry {
  constructor() {
    this._items = new Set();
  }

  /**
   * Track a resource. Accepts a single object, an array, or a plain object
   * bag of resources. Returns the registry for chaining.
   */
  track(...resources) {
    for (const res of resources) {
      if (res && typeof res.dispose === 'function') this._items.add(res);
    }
    return this;
  }

  /** Dispose one tracked resource and forget it. */
  dispose(resource) {
    if (this._items.delete(resource) && typeof resource.dispose === 'function') {
      try { resource.dispose(); } catch { /* already disposed */ }
    }
  }

  /**
   * Untrack a resource WITHOUT disposing it. Used for the renderer, which
   * owns the WebGL context and must outlive every geometry/material/texture
   * deletion (those must run while the context is still alive).
   */
  remove(resource) {
    this._items.delete(resource);
    return this;
  }

  /** Dispose everything tracked. Safe to call multiple times. */
  disposeAll() {
    for (const res of this._items) {
      try { res.dispose(); } catch { /* already disposed */ }
    }
    this._items.clear();
  }

  get count() { return this._items.size; }
}
