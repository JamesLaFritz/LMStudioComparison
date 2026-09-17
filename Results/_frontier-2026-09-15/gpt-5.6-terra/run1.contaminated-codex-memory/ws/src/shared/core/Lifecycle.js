/**
 * Tiny LIFO cleanup stack for non-WebGL resources such as subscriptions and
 * timers. It intentionally has no Three.js knowledge; use ResourceRegistry
 * for GPU ownership.
 */
export class Lifecycle {
  constructor() {
    this._cleanups = [];
    this.disposed = false;
  }

  add(cleanup) {
    if (typeof cleanup !== 'function') return cleanup;
    if (this.disposed) {
      cleanup();
      return cleanup;
    }
    this._cleanups.push(cleanup);
    return cleanup;
  }

  listen(target, type, listener, options) {
    target?.addEventListener?.(type, listener, options);
    this.add(() => target?.removeEventListener?.(type, listener, options));
    return listener;
  }

  timeout(callback, milliseconds) {
    const handle = globalThis.setTimeout(callback, milliseconds);
    this.add(() => globalThis.clearTimeout(handle));
    return handle;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (let index = this._cleanups.length - 1; index >= 0; index -= 1) {
      try {
        this._cleanups[index]();
      } catch {
        // A best-effort release of one external resource must not leak others.
      }
    }
    this._cleanups.length = 0;
  }
}
