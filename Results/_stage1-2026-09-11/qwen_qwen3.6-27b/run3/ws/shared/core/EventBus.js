export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(fn);
    // Return a handle for off()
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(fn);
      if (set.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  emit(event, data) {
    const set = this._listeners.get(event);
    if (set) {
      for (const fn of set) {
        try {
          fn(data);
        } catch (e) {
          console.error(`EventBus error in listener for "${event}":`, e);
        }
      }
    }
  }

  clear() {
    this._listeners.clear();
  }
}
