/**
 * InputController — unified keyboard + Gamepad API.
 *
 * Identical semantics for both sources:
 *   axisX / axisY      — continuous movement (-1..1), deadzone 0.2
 *   firePressed        — edge-triggered (true for exactly one poll)
 *   fire               — level (held)
 *   pausePressed       — edge-triggered
 *   startPressed       — edge-triggered
 *   vibrate(i, ms)     — gamepad rumble (no-op without a pad)
 *
 * Poll once per frame from the game loop; edge state is consumed on poll.
 */
const DEADZONE = 0.2;

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'fire', KeyJ: 'fire',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'start', KeyR: 'start',
};

function deadzone(v) {
  if (Math.abs(v) < DEADZONE) return 0;
  return (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
}

export default class InputController {
  constructor() {
    this.isGamepadActive = false;
    this._keys = new Set();
    this._padIndex = null;
    this._pad = null;
    this._prevFire = false;
    this._prevPause = false;
    this._prevStart = false;
    this._firePressed = false;
    this._pausePressed = false;
    this._startPressed = false;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onPad = this._onPad.bind(this);
    this._onBlur = this._onBlur.bind(this);
  }

  attach() {
    // keydown must be non-passive: we call preventDefault() for fire/pause/start
    // so Space/Enter don't scroll or re-trigger focused buttons.
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp, { passive: true });
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('gamepadconnected', this._onPad);
    window.addEventListener('gamepaddisconnected', this._onPad);
    this._scanPads();
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('gamepadconnected', this._onPad);
    window.removeEventListener('gamepaddisconnected', this._onPad);
    this._keys.clear();
    this._pad = null;
    this._padIndex = null;
    this.isGamepadActive = false;
  }

  _onKeyDown(e) {
    const action = KEY_MAP[e.code];
    if (!action) return;
    if (action === 'fire' || action === 'start' || action === 'pause') e.preventDefault();
    this._keys.add(action);
  }

  _onKeyUp(e) {
    const action = KEY_MAP[e.code];
    if (action) this._keys.delete(action);
  }

  _onBlur() {
    this._keys.clear();
  }

  _onPad() {
    this._scanPads();
  }

  _scanPads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let found = null;
    for (const p of pads) {
      if (p && p.connected) { found = p; break; }
    }
    this._pad = found;
    this._padIndex = found ? found.index : null;
    this.isGamepadActive = !!found;
  }

  _padAxis() {
    if (!this._pad) return { x: 0, y: 0 };
    const ax = this._pad.axes[0] || 0;
    const ay = this._pad.axes[1] || 0;
    return { x: deadzone(ax), y: deadzone(ay) };
  }

  _padButtons() {
    if (!this._pad) return { fire: false, pause: false, start: false };
    const b = this._pad.buttons;
    // A (0) = fire, B (1) = start, Start (9) = pause. Kept distinct so a
    // single press never triggers two actions at once.
    const fire = (b[0] && b[0].pressed) || (b[2] && b[2].pressed);
    const pause = b[9] && b[9].pressed;
    const start = b[1] && b[1].pressed;
    return { fire, pause, start };
  }

  /**
   * Poll once per frame. Returns a snapshot; edge flags are consumed here.
   */
  poll() {
    this._scanPads();
    const k = this._keys;
    const pad = this._padButtons();
    const axes = this._padAxis();

    const axisX = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + axes.x;
    const axisY = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0) + axes.y;

    const fire = k.has('fire') || pad.fire;
    const pause = k.has('pause') || pad.pause;
    const start = k.has('start') || pad.start;

    this._firePressed = fire && !this._prevFire;
    this._pausePressed = pause && !this._prevPause;
    this._startPressed = start && !this._prevStart;
    this._prevFire = fire;
    this._prevPause = pause;
    this._prevStart = start;

    return {
      axisX: Math.max(-1, Math.min(1, axisX)),
      axisY: Math.max(-1, Math.min(1, axisY)),
      fire,
      firePressed: this._firePressed,
      pause,
      pausePressed: this._pausePressed,
      start,
      startPressed: this._startPressed,
    };
  }

  /** Rumble: intensity 0..1, duration ms. No-op without a gamepad. */
  vibrate(intensity, ms) {
    if (!this._pad) return;
    const gp = this._pad;
    if (gp.vibrationActuator && gp.vibrationActuator.playEffect) {
      gp.vibrationActuator.playEffect('dual-rumble', {
        duration: ms,
        strongMagnitude: Math.min(1, intensity),
        weakMagnitude: Math.min(1, intensity * 0.6),
      }).catch(() => {});
    }
  }
}
