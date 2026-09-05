/**
 * Minimal typed pub/sub with guaranteed teardown.
 *
 * The design constraint is that a game can be unmounted at any moment. Every
 * `on` returns an unsubscribe function, and `clear()` drops every listener at
 * once — so an orphaned subscriber can never keep a dead game's closure (and
 * therefore its entire scene graph) alive after `dispose()`.
 *
 * Emission iterates a snapshot of the listener array so that handlers may
 * safely subscribe or unsubscribe during dispatch, which happens constantly:
 * an "invader killed" handler frequently emits "wave cleared", which tears down
 * gameplay listeners mid-flight.
 */

export class EventBus {
  constructor() {
    /** @type {Map<string, Function[]>} */
    this.listeners = new Map();
    /** Guards against runaway recursive emission (A emits B emits A ...). */
    this.depth = 0;
    this.maxDepth = 16;
  }

  /**
   * Subscribe to an event.
   * @param {string} type
   * @param {Function} handler
   * @returns {() => void} unsubscribe
   */
  on(type, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`EventBus.on("${type}") requires a function handler.`);
    }
    let arr = this.listeners.get(type);
    if (!arr) {
      arr = [];
      this.listeners.set(type, arr);
    }
    arr.push(handler);
    return () => this.off(type, handler);
  }

  /**
   * Subscribe for exactly one dispatch.
   * @returns {() => void} unsubscribe (safe to call after it has already fired)
   */
  once(type, handler) {
    const wrapped = (payload) => {
      this.off(type, wrapped);
      handler(payload);
    };
    return this.on(type, wrapped);
  }

  /** Remove a specific handler. */
  off(type, handler) {
    const arr = this.listeners.get(type);
    if (!arr) return;
    const i = arr.indexOf(handler);
    if (i !== -1) arr.splice(i, 1);
    if (arr.length === 0) this.listeners.delete(type);
  }

  /**
   * Dispatch synchronously. A throwing handler is logged and skipped rather
   * than being allowed to abort the remaining handlers — one broken VFX
   * listener must not stop the scoring listener from running.
   */
  emit(type, payload) {
    const arr = this.listeners.get(type);
    if (!arr || arr.length === 0) return;

    if (this.depth >= this.maxDepth) {
      console.warn(`EventBus: recursion limit reached while emitting "${type}".`);
      return;
    }

    this.depth++;
    // Snapshot: handlers are allowed to mutate the subscription list.
    const snapshot = arr.slice();
    for (let i = 0; i < snapshot.length; i++) {
      try {
        snapshot[i](payload);
      } catch (err) {
        console.error(`EventBus handler for "${type}" threw:`, err);
      }
    }
    this.depth--;
  }

  /** Number of handlers registered for a type. Used by tests and the debug panel. */
  count(type) {
    const arr = this.listeners.get(type);
    return arr ? arr.length : 0;
  }

  /** Drop every listener. Called unconditionally during game teardown. */
  clear() {
    this.listeners.clear();
    this.depth = 0;
  }
}
