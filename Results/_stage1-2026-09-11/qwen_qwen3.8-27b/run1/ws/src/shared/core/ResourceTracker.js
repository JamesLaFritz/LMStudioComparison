/**
 * ResourceTracker — central registry for disposables (geometries, materials,
 * textures). Enforces the strict memory-management requirement: the facade
 * tracks everything it creates and calls disposeAll() on stop().
 *
 * Idempotent: calling disposeAll() twice is safe.
 */
export class ResourceTracker {
  constructor() {
    /** @type {Set<object>} */
    this._items = new Set();
    this._disposed = false;
  }

  /**
   * Track a disposable (anything with a .dispose() method).
   * @param {object} item
   * @returns {object} the same item (for chaining / inline use)
   */
  track(item) {
    if (item && typeof item.dispose === 'function' && !this._disposed) {
      this._items.add(item);
    }
    return item;
  }

  /** Number of tracked disposables (for diagnostics). */
  get count() {
    return this._items.size;
  }

  /**
   * Dispose every tracked item and clear the set.
   * Safe to call multiple times.
   */
  disposeAll() {
    if (this._disposed) return;
    this._disposed = true;
    for (const item of this._items) {
      try {
        item.dispose();
      } catch (err) {
        // A failing dispose must not abort the cascade.
        console.warn('[ResourceTracker] dispose threw:', err);
      }
    }
    this._items.clear();
  }
}
