/**
 * Fixed-capacity object pool.
 *
 * Every projectile, particle, debris chunk, shockwave ring, trail and floating
 * score label in this arcade comes from one of these. Nothing gameplay-related
 * is allocated after `init()` returns.
 *
 * The motivation is not raw allocation speed — modern JS engines allocate very
 * quickly. It is **garbage collection latency**. A game that allocates a few
 * hundred short-lived objects per second will trigger minor GCs at
 * unpredictable moments, and a 6ms GC pause inside a 16.6ms frame budget is a
 * visible stutter. Since the stutter correlates with heavy action — which is
 * exactly when the player is paying most attention — it is disproportionately
 * damaging. Pooling makes the steady-state allocation rate zero.
 *
 * Design decisions:
 *
 *  - **Free list as a stack**, not a queue. LIFO reuse keeps the most recently
 *    touched object hot in cache.
 *  - **Active set as a dense array** with swap-remove, so iteration over live
 *    objects has no holes and no branch per slot.
 *  - **`highWater` is tracked** so the debug panel can show whether a pool is
 *    correctly sized. A pool that never exceeds 40% is wasting memory; one that
 *    saturates is silently dropping gameplay.
 */
export class ObjectPool {
  /**
   * @param {() => object} factory constructs one instance; called `capacity` times at most
   * @param {object} [opts]
   * @param {number} [opts.capacity]  hard ceiling on live objects
   * @param {number} [opts.prewarm]   how many to construct up front
   * @param {(obj:object, args:*) => void} [opts.onAcquire]
   * @param {(obj:object) => void} [opts.onRelease]
   * @param {(obj:object) => void} [opts.onDispose]
   */
  constructor(factory, opts = {}) {
    const {
      capacity = 64,
      prewarm = 0,
      onAcquire = null,
      onRelease = null,
      onDispose = null,
      label = 'pool'
    } = opts;

    if (typeof factory !== 'function') {
      throw new TypeError('ObjectPool requires a factory function.');
    }

    this.factory = factory;
    this.capacity = capacity;
    this.label = label;
    this.hooks = { onAcquire, onRelease, onDispose };

    /** @type {object[]} every object ever created by this pool */
    this.all = [];
    /** @type {object[]} objects available for reuse */
    this.free = [];
    /** @type {object[]} objects currently checked out, dense */
    this.active = [];

    this.highWater = 0;
    /** Incremented whenever an acquire fails because the pool is exhausted. */
    this.starvedCount = 0;
    this.disposed = false;

    const n = Math.min(prewarm, capacity);
    for (let i = 0; i < n; i++) {
      const obj = this._construct();
      this.free.push(obj);
    }
  }

  _construct() {
    const obj = this.factory();
    obj.poolActive = false;
    obj.poolIndex = -1;
    this.all.push(obj);
    return obj;
  }

  /** Number of objects currently checked out. */
  get activeCount() {
    return this.active.length;
  }

  /** Number of objects that could still be handed out. */
  get available() {
    return this.capacity - this.active.length;
  }

  /** True when nothing more can be acquired. */
  get exhausted() {
    return this.active.length >= this.capacity;
  }

  /**
   * Check out an object.
   *
   * Returns `null` rather than growing when exhausted. Silent growth is the
   * wrong behaviour for a game: a runaway spawn bug would quietly consume
   * memory until the tab died, whereas a null return surfaces immediately as a
   * missing projectile and is caught in the first playtest. Callers that must
   * always succeed should use `acquireOrRecycle`.
   *
   * @param {*} [args] forwarded to `onAcquire`
   * @returns {object|null}
   */
  acquire(args) {
    if (this.disposed) return null;

    if (this.active.length >= this.capacity) {
      this.starvedCount++;
      return null;
    }

    let obj = this.free.pop();
    if (!obj) {
      if (this.all.length >= this.capacity) {
        this.starvedCount++;
        return null;
      }
      obj = this._construct();
    }

    obj.poolActive = true;
    obj.poolIndex = this.active.length;
    this.active.push(obj);

    if (this.active.length > this.highWater) this.highWater = this.active.length;

    if (this.hooks.onAcquire) this.hooks.onAcquire(obj, args);
    else if (typeof obj.onAcquire === 'function') obj.onAcquire(args);

    return obj;
  }

  /**
   * Check out an object, forcibly recycling the oldest active one if the pool
   * is exhausted.
   *
   * Used where dropping the request is worse than interrupting an in-flight
   * effect — a shockwave from the player's death must appear even if twelve
   * rings are already on screen.
   */
  acquireOrRecycle(args) {
    const obj = this.acquire(args);
    if (obj) return obj;
    if (this.active.length === 0) return null;

    // active[0] is the oldest surviving entry given swap-remove ordering.
    this.release(this.active[0]);
    return this.acquire(args);
  }

  /**
   * Return an object to the pool.
   *
   * Safe to call on an already-released object; double-release is a common
   * pattern when an entity is destroyed by two systems in the same frame
   * (hit by a bullet *and* reaching the kill line), and it must not corrupt
   * the free list.
   */
  release(obj) {
    if (!obj || !obj.poolActive) return false;

    if (this.hooks.onRelease) this.hooks.onRelease(obj);
    else if (typeof obj.onRelease === 'function') obj.onRelease();

    // Swap-remove: move the last active object into the freed slot so the
    // active array stays dense with no shifting.
    const index = obj.poolIndex;
    const last = this.active.pop();
    if (last !== obj) {
      this.active[index] = last;
      last.poolIndex = index;
    }

    obj.poolActive = false;
    obj.poolIndex = -1;
    this.free.push(obj);
    return true;
  }

  /**
   * Release everything. Iterates backwards because `release` mutates the active
   * array — a forward loop would skip every other element.
   */
  releaseAll() {
    for (let i = this.active.length - 1; i >= 0; i--) {
      this.release(this.active[i]);
    }
  }

  /**
   * Iterate live objects safely under mutation.
   *
   * The callback is allowed to release the object it is given — which happens
   * constantly, since "update this projectile" and "this projectile expired"
   * are the same code path. Iterating backwards makes swap-remove safe.
   *
   * @param {(obj:object, index:number) => void} fn
   */
  forEachActive(fn) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      fn(this.active[i], i);
    }
  }

  /** Occupancy as a fraction of capacity. Shown in the debug panel. */
  get occupancy() {
    return this.capacity > 0 ? this.active.length / this.capacity : 0;
  }

  /**
   * Destroy every object the pool ever created, including free ones. This is
   * the only path that actually releases GPU resources.
   */
  dispose() {
    if (this.disposed) return;
    this.releaseAll();

    for (const obj of this.all) {
      if (this.hooks.onDispose) this.hooks.onDispose(obj);
      else if (typeof obj.onDispose === 'function') obj.onDispose();
    }

    this.all.length = 0;
    this.free.length = 0;
    this.active.length = 0;
    this.disposed = true;
  }

  /** Diagnostic snapshot for the debug panel. */
  stats() {
    return {
      label: this.label,
      active: this.active.length,
      capacity: this.capacity,
      highWater: this.highWater,
      starved: this.starvedCount,
      occupancy: this.occupancy
    };
  }
}
