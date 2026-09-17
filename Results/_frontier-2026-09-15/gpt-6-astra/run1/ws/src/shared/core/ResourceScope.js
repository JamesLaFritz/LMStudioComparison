export class ResourceScope {
  constructor() {
    this.resources = new Map();
    this.order = [];
    this.disposed = false;
  }
  own(resource, disposer = null) {
    if (this.disposed) throw new Error("Resource scope is disposed");
    if (!this.resources.has(resource)) {
      this.resources.set(resource, disposer ?? (() => resource.dispose()));
      this.order.push(resource);
    }
    return resource;
  }
  defer(cleanup) {
    return this.own(cleanup, cleanup);
  }
  disposeOwned(resource) {
    const cleanup = this.resources.get(resource);
    if (!cleanup) return;
    this.resources.delete(resource);
    const index = this.order.indexOf(resource);
    if (index >= 0) this.order.splice(index, 1);
    cleanup();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const errors = [];
    for (let i = this.order.length - 1; i >= 0; i--) {
      try {
        this.disposeOwned(this.order[i]);
      } catch (error) {
        errors.push(error);
      }
    }
    this.order.length = 0;
    this.resources.clear();
    if (errors.length) console.error("Resource cleanup failed", errors);
  }
}
