// shared/core/Input.js
// Unified dual-input: Keyboard (WASD/Arrows) + Gamepad API.
// Poll-based: call update() each frame, then read axisX / fire / jump / pause.

const KEY_LEFT = new Set(['KeyA', 'ArrowLeft']);
const KEY_RIGHT = new Set(['KeyD', 'ArrowRight']);
const KEY_UP = new Set(['KeyW', 'ArrowUp']);
const KEY_DOWN = new Set(['KeyS', 'ArrowDown']);
const KEY_FIRE = new Set(['Space', 'KeyJ', 'KeyZ']);
const KEY_PAUSE = new Set(['Escape', 'KeyP']);

export class Input {
  constructor() {
    this._keys = new Set();
    this._gamepad = null;
    this._firePressed = false;   // edge (this frame)
    this._fireHeld = false;
    this._pausePressed = false;
    this._prevFire = false;
    this._prevPause = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this._keys.add(e.code);
      if (KEY_FIRE.has(e.code)) this._firePressed = true;
      if (KEY_PAUSE.has(e.code)) this._pausePressed = true;
      if (e.code === 'Space') e.preventDefault();
    };
    this._onKeyUp = (e) => { this._keys.delete(e.code); };
    this._onBlur = () => { this._keys.clear(); };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  update() {
    // --- Keyboard axis ---
    let axisX = 0;
    for (const c of this._keys) {
      if (KEY_LEFT.has(c)) axisX -= 1;
      if (KEY_RIGHT.has(c)) axisX += 1;
    }
    let axisY = 0;
    for (const c of this._keys) {
      if (KEY_UP.has(c)) axisY += 1;
      if (KEY_DOWN.has(c)) axisY -= 1;
    }
    let fireHeld = false;
    for (const c of this._keys) if (KEY_FIRE.has(c)) fireHeld = true;

    // --- Gamepad (first connected) ---
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected) { this._gamepad = p; break; }
    }
    const gp = this._gamepad;
    if (gp) {
      const dead = 0.25;
      const gx = gp.axes[0] || 0;
      if (Math.abs(gx) > dead) axisX = Math.max(-1, Math.min(1, axisX + gx));
      const gy = gp.axes[1] || 0;
      if (Math.abs(gy) > dead) axisY = Math.max(-1, Math.min(1, axisY + gy));
      const gpFire = !!(gp.buttons[0] && gp.buttons[0].pressed) || !!(gp.buttons[2] && gp.buttons[2].pressed);
      if (gpFire) fireHeld = true;
    }

    // --- Edge detection ---
    this._firePressed = this._firePressed || (fireHeld && !this._prevFire);
    this._pausePressed = this._pausePressed || ((this._keys.has('Escape') || this._keys.has('KeyP')) && !this._prevPause);
    this._prevFire = fireHeld;
    this._prevPause = this._keys.has('Escape') || this._keys.has('KeyP');

    this.axisX = axisX;
    this.axisY = axisY;
    this.fireHeld = fireHeld;
  }

  // Consume edge events (return true once).
  consumeFire() { const v = this._firePressed; this._firePressed = false; return v; }
  consumePause() { const v = this._pausePressed; this._pausePressed = false; return v; }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
