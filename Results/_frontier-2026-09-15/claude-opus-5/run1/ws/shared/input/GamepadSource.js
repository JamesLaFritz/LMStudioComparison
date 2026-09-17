// Gamepad API polling with radial dead-zone, reconnection handling and optional rumble.
// Standard mapping indices: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start,
// 10 LS, 11 RS, 12 Up, 13 Down, 14 Left, 15 Right. Axes: 0/1 left stick, 2/3 right stick.

const MAX_BUTTONS = 20;
const MAX_AXES = 4;

export class GamepadSource {
  constructor({ deadzone = 0.2 } = {}) {
    this.deadzone = deadzone;
    this.index = -1;
    this.connected = false;
    this.buttons = new Float32Array(MAX_BUTTONS);
    this.axes = new Float32Array(MAX_AXES);
    this.lastActivity = 0;
    this._pad = null;

    this._onConnect = (e) => {
      if (this.index === -1) this.index = e.gamepad.index;
      this.connected = true;
    };
    this._onDisconnect = (e) => {
      if (e.gamepad.index === this.index) {
        this.index = -1;
        this.connected = false;
        this.buttons.fill(0);
        this.axes.fill(0);
      }
    };
    window.addEventListener('gamepadconnected', this._onConnect);
    window.addEventListener('gamepaddisconnected', this._onDisconnect);
  }

  _getPads() {
    try {
      return navigator.getGamepads ? navigator.getGamepads() : [];
    } catch {
      return [];
    }
  }

  poll() {
    const pads = this._getPads();
    let pad = this.index >= 0 ? pads[this.index] : null;
    if (!pad) {
      // Adopt the first live pad if ours vanished or none was ever chosen.
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) {
          pad = pads[i];
          this.index = i;
          break;
        }
      }
    }
    this._pad = pad || null;
    this.connected = !!pad;
    if (!pad) {
      this.buttons.fill(0);
      this.axes.fill(0);
      return;
    }

    let active = false;
    const nb = Math.min(pad.buttons.length, MAX_BUTTONS);
    for (let i = 0; i < nb; i++) {
      const b = pad.buttons[i];
      const v = typeof b === 'object' ? b.value : b;
      this.buttons[i] = v;
      if (v > 0.5) active = true;
    }
    for (let i = nb; i < MAX_BUTTONS; i++) this.buttons[i] = 0;

    // Radial dead-zone per stick, rescaled so full deflection still reaches 1.
    for (let s = 0; s < 2; s++) {
      const ix = s * 2;
      const iy = s * 2 + 1;
      let x = pad.axes.length > ix ? pad.axes[ix] : 0;
      let y = pad.axes.length > iy ? pad.axes[iy] : 0;
      const mag = Math.hypot(x, y);
      if (mag < this.deadzone) {
        x = 0;
        y = 0;
      } else {
        const scale = Math.min(1, (mag - this.deadzone) / (1 - this.deadzone)) / mag;
        x *= scale;
        y *= scale;
        active = true;
      }
      this.axes[ix] = x;
      this.axes[iy] = y;
    }
    if (active) this.lastActivity = performance.now();
  }

  button(i) {
    return i < MAX_BUTTONS ? this.buttons[i] : 0;
  }

  isDown(i) {
    return this.button(i) > 0.5;
  }

  axis(i) {
    return i < MAX_AXES ? this.axes[i] : 0;
  }

  /** Haptic pulse where supported (Chrome/Edge dual-rumble). */
  rumble(duration = 120, weak = 0.5, strong = 0.5) {
    const pad = this._pad;
    if (!pad) return;
    const actuator = pad.vibrationActuator || (pad.hapticActuators && pad.hapticActuators[0]);
    if (!actuator) return;
    try {
      if (typeof actuator.playEffect === 'function') {
        actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration,
          weakMagnitude: weak,
          strongMagnitude: strong,
        }).catch(() => {});
      } else if (typeof actuator.pulse === 'function') {
        actuator.pulse(strong, duration).catch(() => {});
      }
    } catch {
      /* haptics are best-effort */
    }
  }

  dispose() {
    window.removeEventListener('gamepadconnected', this._onConnect);
    window.removeEventListener('gamepaddisconnected', this._onDisconnect);
    this._pad = null;
  }
}
