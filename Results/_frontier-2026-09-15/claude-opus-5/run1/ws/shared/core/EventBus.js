// Minimal typed pub/sub. Handlers may unsubscribe during dispatch; the listener list is
// snapshotted per emit so iteration stays stable.

export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  /** Subscribe. Returns an unsubscribe function. */
  on(type, handler) {
    let list = this._listeners.get(type);
    if (!list) {
      list = [];
      this._listeners.set(type, list);
    }
    list.push(handler);
    return () => this.off(type, handler);
  }

  once(type, handler) {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(type, handler) {
    const list = this._listeners.get(type);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) this._listeners.delete(type);
  }

  emit(type, payload) {
    const list = this._listeners.get(type);
    if (!list || list.length === 0) return;
    const snapshot = list.length === 1 ? list : list.slice();
    for (let i = 0; i < snapshot.length; i++) snapshot[i](payload);
  }

  listenerCount(type) {
    const list = this._listeners.get(type);
    return list ? list.length : 0;
  }

  clear() {
    this._listeners.clear();
  }
}
