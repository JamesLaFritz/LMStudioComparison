// Named-state machine with enter/exit/update/fixedUpdate hooks. Hooks are invoked with
// `owner` as `this`, so a game can register plain methods.

export class StateMachine {
  constructor(owner = null) {
    this.owner = owner;
    this.current = null;
    this.previous = null;
    this.time = 0;
    this.onChange = null;
    this._states = new Map();
    this._transitioning = false;
  }

  /**
   * @param {string} name
   * @param {{enter?:Function, exit?:Function, update?:Function, fixedUpdate?:Function}} def
   */
  add(name, def) {
    this._states.set(name, def);
    return this;
  }

  has(name) {
    return this._states.has(name);
  }

  is(name) {
    return this.current === name;
  }

  set(name, payload = undefined) {
    const def = this._states.get(name);
    if (!def) throw new Error(`StateMachine: unknown state "${name}"`);
    if (this._transitioning) throw new Error(`StateMachine: re-entrant transition to "${name}"`);
    this._transitioning = true;
    const from = this.current;
    if (from !== null) {
      const fromDef = this._states.get(from);
      if (fromDef.exit) fromDef.exit.call(this.owner, name);
    }
    this.previous = from;
    this.current = name;
    this.time = 0;
    this._transitioning = false;
    if (def.enter) def.enter.call(this.owner, payload, from);
    if (this.onChange) this.onChange(from, name);
  }

  update(dt) {
    if (this.current === null) return;
    this.time += dt;
    const def = this._states.get(this.current);
    if (def.update) def.update.call(this.owner, dt);
  }

  fixedUpdate(step) {
    if (this.current === null) return;
    const def = this._states.get(this.current);
    if (def.fixedUpdate) def.fixedUpdate.call(this.owner, step);
  }
}
