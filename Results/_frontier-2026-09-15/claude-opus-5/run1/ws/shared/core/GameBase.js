// Abstract game lifecycle. The Engine owns the loop and calls these in order:
//   init(engine) once → fixedUpdate(step) 0..N times per frame → update(dt, realDt) → render (engine).
// `onResize` is called after init and on every viewport change; `dispose` on teardown.

export class GameBase {
  constructor() {
    this.engine = null;
  }

  /** @param {import('./Engine.js').Engine} engine */
  init(engine) {
    this.engine = engine;
  }

  /** Deterministic simulation step (seconds, scaled by hit-stop). */
  fixedUpdate(step) {} // eslint-disable-line no-unused-vars

  /** Per-frame update. `dt` is scaled time, `realDt` is wall-clock time. */
  update(dt, realDt) {} // eslint-disable-line no-unused-vars

  onResize(width, height) {} // eslint-disable-line no-unused-vars

  dispose() {
    this.engine = null;
  }
}
