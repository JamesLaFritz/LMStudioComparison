/**
 * EventBus — minimal typed pub/sub.
 *
 *   const bus = new EventBus();
 *   const off = bus.on('kill', (data) => { ... });
 *   bus.emit('kill', { score: 30 });
 *   off();            // unsubscribes
 *   bus.clear();      // drop all listeners
 */
export default class EventBus {
  constructor() {
    /** @type {Map<string, Array<{ fn: Function, once: boolean }>>} */
    this._map = new Map();
  }

  /**
   * Subscribe. Returns an unsubscribe function.
   * @param {string} event
   * @param {Function} fn
   * @param {{ once?: boolean }} [opts]
   * @returns {() => void}
   */
  on(event, fn, opts = {}) {
    if (typeof fn !== 'function') throw new Error(`EventBus.on: listener for "${event}" is not a function`);
    let list = this._map.get(event);
    if (!list) {
      list = [];
      this._map.set(event, list);
    }
    const entry = { fn, once: !!opts.once };
    list.push(entry);
    return () => this.off(event, fn);
  }

  /** Subscribe for exactly one emission. */
  once(event, fn) {
    return this.on(event, fn, { once: true });
  }

  /** Unsubscribe a specific listener (no-op if not found). */
  off(event, fn) {
    const list = this._map.get(event);
    if (!list) return;
    const i = list.findIndex((e) => e.fn === fn);
    if (i !== -1) list.splice(i, 1);
    if (list.length === 0) this._map.delete(event);
  }

  /**
   * Emit to all listeners. Listeners that unsubscribe during the emit
   * (or are `once`) do not break iteration.
   * @param {string} event
   * @param {*} [payload]
   */
  emit(event, payload) {
    const list = this._map.get(event);
    if (!list || list.length === 0) return;
    // Snapshot so off()/once() during dispatch is safe.
    const snapshot = list.slice();
    for (const entry of snapshot) {
      if (entry.once) this.off(event, entry.fn);
      entry.fn(payload);
    }
  }

  /** Remove every listener. */
  clear() {
    this._map.clear();
  }
}
