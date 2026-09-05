/**
 * A small, strict finite state machine.
 *
 * Used at two very different scales: the top-level game flow
 * (BOOT → ATTRACT → WARP_IN → PLAY → …) and individual entity AI. The
 * behaviour that matters for both is *deferred transitions*: calling
 * `change()` from inside an `update` does not immediately re-enter, it queues
 * the transition until the current update returns. Without that, a state that
 * changes itself mid-update leaves the caller running code belonging to a
 * state that has already exited — a bug that is miserable to track down.
 */
export class StateMachine {
  /**
   * @param {Record<string, {enter?:Function, update?:Function, exit?:Function}>} states
   * @param {string} initial
   * @param {*} [owner] passed as the first argument to every callback
   */
  constructor(states, initial, owner = null) {
    this.states = states;
    this.owner = owner;
    this.current = null;
    this.currentName = '';
    this.previousName = '';
    this.timeInState = 0;
    this.payload = null;

    this._pending = null;
    this._updating = false;

    if (initial) this.change(initial);
  }

  /** True when the named state is active. */
  is(name) {
    return this.currentName === name;
  }

  /** True when the active state is any of the supplied names. */
  isAny(...names) {
    return names.includes(this.currentName);
  }

  /**
   * Request a transition. Safe to call from inside an `update`.
   * @param {string} name
   * @param {*} [payload] handed to the new state's `enter`
   * @param {boolean} [force] allow re-entering the state that is already active
   */
  change(name, payload = null, force = false) {
    if (!this.states[name]) {
      console.error(`StateMachine: unknown state "${name}".`);
      return;
    }
    if (!force && this.currentName === name) return;

    if (this._updating) {
      this._pending = { name, payload };
      return;
    }
    this._apply(name, payload);
  }

  _apply(name, payload) {
    const next = this.states[name];

    if (this.current && typeof this.current.exit === 'function') {
      this.current.exit(this.owner, name);
    }

    this.previousName = this.currentName;
    this.current = next;
    this.currentName = name;
    this.timeInState = 0;
    this.payload = payload;

    if (typeof next.enter === 'function') {
      next.enter(this.owner, payload, this.previousName);
    }
  }

  /**
   * Advance the active state. Any transition requested during the update is
   * applied immediately afterwards, and the new state's `update` does *not*
   * run until the next tick — states always get a clean frame to initialise in.
   */
  update(dt, ...args) {
    if (!this.current) return;

    this.timeInState += dt;
    this._updating = true;
    if (typeof this.current.update === 'function') {
      this.current.update(this.owner, dt, ...args);
    }
    this._updating = false;

    if (this._pending) {
      const { name, payload } = this._pending;
      this._pending = null;
      this._apply(name, payload);
    }
  }

  /**
   * Exit the active state without entering another. Used during disposal so
   * that `exit` handlers (which commonly remove DOM overlays) always run.
   */
  shutdown() {
    if (this.current && typeof this.current.exit === 'function') {
      this.current.exit(this.owner, null);
    }
    this.current = null;
    this.currentName = '';
    this._pending = null;
  }
}
