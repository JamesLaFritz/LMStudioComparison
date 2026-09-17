function hasTransition(transitions, current, next) {
  const candidates = transitions instanceof Map
    ? (transitions.get(current) ?? transitions.get('*'))
    : (transitions?.[current] ?? transitions?.['*']);

  if (candidates instanceof Set || Array.isArray(candidates)) return candidates.has?.(next) ?? candidates.includes(next);
  if (candidates instanceof Map) return Boolean(candidates.get(next));
  if (typeof candidates === 'string' || typeof candidates === 'number' || typeof candidates === 'symbol') {
    return candidates === next;
  }
  if (candidates && typeof candidates === 'object') return Boolean(candidates[next]);
  return false;
}

/** Minimal deterministic state machine with an explicit transition table. */
export class StateMachine {
  constructor({ initial, transitions, onTransition = () => {} } = {}) {
    if (initial === undefined || initial === null) throw new TypeError('StateMachine initial state is required');
    if (transitions === undefined || transitions === null) throw new TypeError('StateMachine transitions are required');
    if (typeof onTransition !== 'function') throw new TypeError('onTransition must be a function');
    this._initial = initial;
    this._state = initial;
    this._transitions = transitions;
    this._onTransition = onTransition;
  }

  get state() {
    return this._state;
  }

  can(next) {
    return hasTransition(this._transitions, this._state, next);
  }

  transition(next, payload) {
    if (!this.can(next)) return false;
    const previous = this._state;
    this._state = next;
    this._onTransition(previous, next, payload);
    return true;
  }

  reset(next = this._initial) {
    this._state = next;
    return this._state;
  }
}
