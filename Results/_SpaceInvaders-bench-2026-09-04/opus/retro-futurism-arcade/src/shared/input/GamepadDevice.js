import { applyDeadzone } from '../util/MathUtils.js';

/**
 * Gamepad API polling.
 *
 * The Gamepad API is a **polling** API, not an event API. `navigator.getGamepads()`
 * returns a fresh snapshot each call, and — critically — the `Gamepad` objects
 * it returns are immutable snapshots in most browsers. Caching one from the
 * `gamepadconnected` event and reading it later gives permanently stale state,
 * which is the classic "my gamepad works for one frame" bug. This class
 * re-fetches the array every poll.
 *
 * ### Deadzone
 *
 * A radial deadzone with rescaling, not a per-axis cutoff. Two reasons: an
 * axis-independent deadzone leaves a square dead region that lets a stick at
 * (0.15, 0.15) register as diagonal motion when the player has not touched it,
 * and without rescaling the remaining range the stick can never reach 1.0 in
 * any direction it is deadzoned on.
 *
 * ### Triggers
 *
 * Analog triggers report `button.value` in [0,1] but `button.pressed` only
 * flips at the browser's own threshold, which varies. A trigger is treated as
 * pressed above `triggerThreshold` so the feel is identical across browsers.
 */
export class GamepadDevice {
  constructor(opts = {}) {
    const { deadzone = 0.18, responseCurve = 2, triggerThreshold = 0.4 } = opts;

    this.deadzone = deadzone;
    this.responseCurve = responseCurve;
    this.triggerThreshold = triggerThreshold;

    /** @type {Gamepad|null} the active pad, refreshed every poll */
    this.pad = null;
    this.index = -1;
    this.connected = false;
    this.id = '';

    /** Axis and button state for the current frame. */
    this.axes = new Float32Array(4);
    this.buttons = new Float32Array(20);

    /** True when any control moved this frame; drives device auto-detect. */
    this.activity = false;

    this.supported =
      typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';

    this._onConnect = this._onConnect.bind(this);
    this._onDisconnect = this._onDisconnect.bind(this);

    window.addEventListener('gamepadconnected', this._onConnect);
    window.addEventListener('gamepaddisconnected', this._onDisconnect);
  }

  _onConnect(event) {
    if (this.index === -1) {
      this.index = event.gamepad.index;
      this.id = event.gamepad.id;
      this.connected = true;
    }
  }

  _onDisconnect(event) {
    if (event.gamepad.index === this.index) {
      this.index = -1;
      this.connected = false;
      this.pad = null;
      this.id = '';
      this.axes.fill(0);
      this.buttons.fill(0);
    }
  }

  /**
   * Sample the pad. Must be called exactly once per frame, before any reads.
   */
  poll() {
    this.activity = false;
    if (!this.supported) return;

    const pads = navigator.getGamepads();
    if (!pads) return;

    // Re-acquire if we have no pad, or the one we had has gone away. Some
    // browsers only populate the array after the first button press, so the
    // connect event alone is not sufficient.
    let pad = this.index >= 0 ? pads[this.index] : null;
    if (!pad || !pad.connected) {
      pad = null;
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) {
          pad = pads[i];
          this.index = i;
          this.id = pads[i].id;
          break;
        }
      }
    }

    if (!pad) {
      if (this.connected) {
        this.connected = false;
        this.axes.fill(0);
        this.buttons.fill(0);
      }
      return;
    }

    this.pad = pad;
    this.connected = true;

    // --- Axes -------------------------------------------------------------
    const axisCount = Math.min(this.axes.length, pad.axes.length);
    for (let i = 0; i < axisCount; i++) {
      const raw = pad.axes[i] || 0;
      const shaped = applyDeadzone(raw, this.deadzone, this.responseCurve);
      if (Math.abs(shaped) > 0.02) this.activity = true;
      this.axes[i] = shaped;
    }

    // --- Buttons ----------------------------------------------------------
    const buttonCount = Math.min(this.buttons.length, pad.buttons.length);
    for (let i = 0; i < buttonCount; i++) {
      const b = pad.buttons[i];
      // `value` covers analog triggers; `pressed` covers digital buttons that
      // report value 0 on some drivers.
      const value = b ? (b.value !== undefined ? b.value : b.pressed ? 1 : 0) : 0;
      const digital = value >= this.triggerThreshold || (b && b.pressed);
      const v = digital ? Math.max(value, 1) : value;
      if (digital) this.activity = true;
      this.buttons[i] = v;
    }
  }

  /** True while the button index is held. */
  isDown(index) {
    return index >= 0 && index < this.buttons.length && this.buttons[index] >= 1;
  }

  /** True if any of the supplied button indices is held. */
  anyDown(indices) {
    for (let i = 0; i < indices.length; i++) {
      if (this.isDown(indices[i])) return true;
    }
    return false;
  }

  /** Deadzoned, curve-shaped axis value. */
  axis(index) {
    return index >= 0 && index < this.axes.length ? this.axes[index] : 0;
  }

  /**
   * Haptic feedback.
   *
   * Wrapped in a try/catch and a capability check because the vibration
   * actuator is inconsistently implemented: it is absent on Safari, present but
   * throwing on some Linux drivers, and rate-limited on others. A rumble
   * failure must never be able to take down a frame.
   *
   * @param {number} duration milliseconds
   * @param {number} weak     0..1 high-frequency motor
   * @param {number} strong   0..1 low-frequency motor
   */
  rumble(duration = 90, weak = 0.3, strong = 0.3) {
    const pad = this.pad;
    if (!pad) return false;

    const actuator = pad.vibrationActuator;
    if (!actuator || typeof actuator.playEffect !== 'function') return false;

    try {
      actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        weakMagnitude: Math.max(0, Math.min(1, weak)),
        strongMagnitude: Math.max(0, Math.min(1, strong))
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Stop any in-flight rumble. Called on pause so the pad does not buzz
   *  through a menu. */
  stopRumble() {
    const pad = this.pad;
    if (!pad || !pad.vibrationActuator) return;
    try {
      if (typeof pad.vibrationActuator.reset === 'function') {
        pad.vibrationActuator.reset();
      } else {
        pad.vibrationActuator.playEffect('dual-rumble', {
          duration: 0,
          weakMagnitude: 0,
          strongMagnitude: 0
        });
      }
    } catch {
      /* ignore */
    }
  }

  dispose() {
    window.removeEventListener('gamepadconnected', this._onConnect);
    window.removeEventListener('gamepaddisconnected', this._onDisconnect);
    this.pad = null;
  }
}
