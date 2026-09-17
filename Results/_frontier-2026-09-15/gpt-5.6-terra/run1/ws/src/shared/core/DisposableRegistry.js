export class DisposableRegistry {
  constructor() {
    this._entries = [];
    this._disposed = false;
  }

  track(resource) {
    if (!resource || typeof resource.dispose !== 'function') {
      return resource;
    }
    this._entries.push(() => resource.dispose());
    return resource;
  }

  add(cleanup) {
    if (typeof cleanup !== 'function') {
      throw new TypeError('DisposableRegistry.add expects a cleanup function.');
    }
    this._entries.push(cleanup);
    return cleanup;
  }

  listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this._entries.push(() => target.removeEventListener(type, listener, options));
    return listener;
  }

  dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    for (let index = this._entries.length - 1; index >= 0; index -= 1) {
      try {
        this._entries[index]();
      } catch (error) {
        console.warn('Resource cleanup failed.', error);
      }
    }
    this._entries.length = 0;
  }
}
