/**
 * InputController — unified dual-input (Keyboard + Gamepad API) into one polled state.
 *
 * Game code NEVER touches raw keydown / navigator.getGamepads(). It polls:
 *   input.update()          // call once per frame, before sim steps
 *   input.axes.x            // -1..+1 merged keyboard+gamepad (deadzone + smoothstep shaped)
 *   input.fire              // held fire (keyboard Space/Enter OR gamepad A / RT)
 *   input.consumeEdge(name) // edge-triggered events: 'fire', 'pause', 'start'
 *
 * Keyboard and gamepad are merged, not sourced — a disconnected pad degrades to
 * keyboard seamlessly. Edge events are queued with a 1-frame grace so they survive
 * being polled after update().
 */

const KEY_LEFT = new Set(['KeyA', 'ArrowLeft']);
const KEY_RIGHT = new Set(['KeyD', 'ArrowRight']);
const KEY_FIRE = new Set(['Space', 'Enter', 'KeyJ']);
const KEY_PAUSE = new Set(['Escape', 'KeyP']);
const KEY_START = new Set(['Enter', 'KeyR']);

function shapeAxis(v) {
  const s = Math.sign(v);
  const a = Math.min(1, Math.abs(v));
  return s * (a * a * (3 - 2 * a)); // smoothstep — fine control near center
}

export class InputController {
  constructor() {
    this.axes = { x: 0, y: 0 };
    this.fire = false;
    this.pauseHeld = false;
    this.startHeld = false;

    this._keysDown = new Set();
    this._pressedSincePoll = [];   // keys that went down since the last update() —
                                   // catches sub-frame taps (keydown+keyup in one RAF)
    this._padIndex = null;
    this._edges = [];          // { name } — queued edge events
    this._prevFire = false;
    this._prevPause = false;
    this._prevStart = false;
    this._graceFrames = 0;     // frames an edge stays consumable after being raised

    this._onKeyDown = (e) => {
      if (KEY_FIRE.has(e.code)) e.preventDefault();
      const isNew = !this._keysDown.has(e.code);
      this._keysDown.add(e.code);
      if (isNew && !e.repeat) this._pressedSincePoll.push(e.code);
    };
    this._onKeyUp = (e) => { this._keysDown.delete(e.code); };
    this._onBlur = () => { this._keysDown.clear(); };
    this._onGamepad = () => { this._detectPad(); };

    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      window.addEventListener('gamepadconnected', this._onGamepad);
      window.addEventListener('gamepaddisconnected', this._onPadDisconnect);
    }
  }

  _detectPad() {
    const pads = navigator.getGamepads();
    for (const p of pads) if (p && p.connected) { this._padIndex = p.index; return; }
  }

  _onPadDisconnect = (e) => {
    if (this._padIndex === e.gamepad?.index) this._padIndex = null;
  };

  /** Poll all sources, merge into axes/fire, raise edge events. Call once per frame. */
  update() {
    // ---- keyboard axis ----
    let kx = 0;
    for (const code of this._keysDown) {
      if (KEY_LEFT.has(code)) kx -= 1;
      else if (KEY_RIGHT.has(code)) kx += 1;
    }

    // ---- gamepad axis + buttons ----
    let gx = 0, gFire = false, gPause = false, gStart = false;
    const pad = this._readPad();
    if (pad) {
      const ax = pad.axes[0] ?? 0;
      if (Math.abs(ax) > 0.18) gx = shapeAxis(ax); // deadzone then smoothstep
      gFire = !!(pad.buttons[0]?.pressed || pad.buttons[5]?.pressed || pad.buttons[7]?.pressed);
      gPause = !!pad.buttons[9]?.pressed;
      gStart = !!pad.buttons[3]?.pressed;
    }

    // ---- merge (gamepad wins on axis when both active) ----
    this.axes.x = Math.abs(gx) > 0.01 ? gx : kx;
    const kbFire = [...this._keysDown].some((c) => KEY_FIRE.has(c));
    this.fire = gFire || kbFire;
    this.pauseHeld = gPause || [...this._keysDown].some((c) => KEY_PAUSE.has(c));
    this.startHeld = gStart || [...this._keysDown].some((c) => KEY_START.has(c));

    // ---- edge detection (rising edges only) ----
    // A key press that lands between polls is still an edge: the event handler
    // records it in _pressedSincePoll, so tap-length inputs are never dropped.
    const fireEdge = (this.fire && !this._prevFire) || this._pressedSincePoll.some((c) => KEY_FIRE.has(c));
    const pauseEdge = (this.pauseHeld && !this._prevPause) || this._pressedSincePoll.some((c) => KEY_PAUSE.has(c));
    const startEdge = (this.startHeld && !this._prevStart) || this._pressedSincePoll.some((c) => KEY_START.has(c));
    if (fireEdge) this._raise('fire');
    if (pauseEdge) this._raise('pause');
    if (startEdge) this._raise('start');

    this._prevFire = this.fire;
    this._prevPause = this.pauseHeld;
    this._prevStart = this.startHeld;
    this._pressedSincePoll.length = 0;

    // edges survive 2 frames after being raised so consumers polled later in the frame still see them
    if (this._graceFrames > 0) this._graceFrames--;
    else if (this._edges.length) this._edges.length = 0;
  }

  _readPad() {
    try {
      const pads = navigator.getGamepads();
      return pads?.[this._padIndex ?? 0] || null;
    } catch { return null; }
  }

  _raise(name) { this._edges.push({ name }); this._graceFrames = 2; }

  /** Consume a queued edge event if present (returns true once). */
  consumeEdge(name) {
    const i = this._edges.findIndex((e) => e.name === name);
    if (i >= 0) { this._edges.splice(i, 1); return true; }
    return false;
  }

  /** Remove listeners. Idempotent. */
  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      window.removeEventListener('gamepadconnected', this._onGamepad);
      window.removeEventListener('gamepaddisconnected', this._onPadDisconnect);
    }
  }
}
