export class StateMachine {
  constructor(states, initialState) {
    this._states = states;
    this._current = null;
    this._currentName = null;
    this.transition(initialState);
  }

  transition(name, payload) {
    if (!this._states[name]) {
      throw new Error(`StateMachine: unknown state "${name}"`);
    }
    if (this._current && typeof this._current.exit === 'function') {
      this._current.exit();
    }
    this._currentName = name;
    this._current = this._states[name];
    if (typeof this._current.enter === 'function') {
      this._current.enter(payload);
    }
  }

  update(dt) {
    if (this._current && typeof this._current.update === 'function') {
      this._current.update(dt);
    }
  }

  get currentName() {
    return this._currentName;
  }

  is(name) {
    return this._currentName === name;
  }
}
