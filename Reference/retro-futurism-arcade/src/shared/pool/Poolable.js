/**
 * The pooling contract.
 *
 * A pooled object is *reused*, never reconstructed, so its constructor runs
 * once for the life of the program and all per-use initialisation must happen
 * in `onAcquire`. The single most common pooling bug is state left over from a
 * previous use — a projectile that inherits the previous projectile's velocity,
 * a particle that starts already half-faded. `onRelease` exists specifically to
 * make cleanup a required, named step rather than something remembered at each
 * call site.
 *
 * This is documented as a base class rather than only as a JSDoc typedef so
 * that subclasses inherit safe no-op defaults and only override what they need.
 */
export class Poolable {
  constructor() {
    /** Set by ObjectPool. True while checked out. */
    this.poolActive = false;
    /** Set by ObjectPool. Index into the pool's storage. */
    this.poolIndex = -1;
  }

  /**
   * Called immediately after the object is handed out.
   * Reset every mutable field here.
   * @param {*} [args]
   */
  // eslint-disable-next-line no-unused-vars
  onAcquire(args) {
    /* override */
  }

  /**
   * Called immediately before the object returns to the free list.
   * Detach from scene graphs, stop audio, clear references to other entities.
   */
  onRelease() {
    /* override */
  }

  /**
   * Called once when the pool itself is disposed. Release GPU resources here —
   * this is the only place a pooled object is genuinely destroyed.
   */
  onDispose() {
    /* override */
  }
}

/**
 * Development-time validation of the pooling contract.
 *
 * `ObjectPool` calls this on every instance it constructs when `strict` is on.
 * Catching a missing or mistyped `onRelease` at pool-construction time is
 * dramatically cheaper than diagnosing the state-bleed bug it causes later,
 * because that bug surfaces as corrupted-looking behaviour in an unrelated
 * entity and depends on reuse order to reproduce.
 *
 * @param {object} obj
 * @param {string} [label] used in the thrown message
 */
export function assertPoolable(obj, label = 'object') {
  if (obj === null || typeof obj !== 'object') {
    throw new TypeError(`${label} is not a poolable object.`);
  }
  for (const hook of ['onAcquire', 'onRelease', 'onDispose']) {
    if (obj[hook] !== undefined && typeof obj[hook] !== 'function') {
      throw new TypeError(`${label}.${hook} must be a function if present.`);
    }
  }
  return true;
}
