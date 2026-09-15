/**
 * InputController — unified keyboard + Gamepad API input, polled once per frame
 * into a single normalized snapshot:
 *   axes.x        -1..+1 (movement)
 *   buttons.fire  held state of the primary fire button
 *   edge.fire     true only on the frame the fire action began
 *   edge.pause    true only on the frame pause was pressed
 *   gamepadActive last poll saw a connected pad with activity
 */

const KEY_LEFT = new Set(['KeyA', 'ArrowLeft']);
const KEY_RIGHT = new Set(['KeyD', 'ArrowRight']);
const KEY_FIRE = new Set(['Space', 'KeyJ', 'Enter']);
const KEY_PAUSE = new Set(['Escape', 'KeyP']);

export class InputController {
  constructor() {
    this._keysDown = new Set();
    this._padButtons = []; // last raw gamepad button states (for edge detection)
    this.gamepadActive = false;

    this.snapshot = {
      axes: { x: 0 },
      buttons: { fire: false, pause: false },
      edge: { fire: false, pause: false }
    };

    window.addEventListener('keydown', (e) => {
      if (KEY_FIRE.has(e.code)) e.preventDefault(); // stop page scroll
      this._keysDown.add(e.code);
    });
    window.addEventListener('keyup', (e) => this._keysDown.delete(e.code));
    window.addEventListener('blur', () => this._keysDown.clear());

    navigator.getGamepads && window.addEventListener('gamepadconnected', () => {
      this.gamepadActive = true;
    });
  }

  /** Poll all sources and refresh the snapshot. Call once per frame, before systems read it. */
  update() {
    const s = this.snapshot;
    let axisX = 0;
    let fireHeld = false;
    let pauseEdge = false;

    // --- keyboard ---
    for (const code of KEY_LEFT) if (this._keysDown.has(code)) axisX -= 1;
    for (const code of KEY_RIGHT) if (this._keysDown.has(code)) axisX += 1;
    const kbFire = [...KEY_FIRE].some((c) => this._keysDown.has(c));
    const kbPause = [...KEY_PAUSE].some((c) => this._keysDown.has(c));

    // --- gamepad (button 0 = fire, button 9 = start/pause; axes[0] = left stick) ---
    let padFireEdge = false;
    if (navigator.getGamepads) {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        this.gamepadActive = true;

        const stick = pad.axes[0] ?? 0;
        if (Math.abs(stick) > 0.25) axisX += Math.sign(stick); // deadzone-ish gate

        const fireNow = !!pad.buttons[0]?.pressed || !!pad.buttons[2]?.pressed;
        const pauseNow = !!pad.buttons[9]?.pressed;
        if (fireNow && !this._padButtons[0]) padFireEdge = true;
        if (pauseNow && !this._padButtons[9]) pauseEdge = true;

        this._padButtons[0] = fireNow;
        this._padButtons[9] = pauseNow;
        fireHeld = fireHeld || fireNow;
      }
    } else {
      this.gamepadActive = false;
    }

    // --- keyboard edges (compare against previous frame's held state) ---
    const kbFireEdge = kbFire && !this._kbFirePrev;
    const kbPauseEdge = kbPause && !this._kbPausePrev;

    s.axes.x = Math.max(-1, Math.min(1, axisX));
    s.buttons.fire = fireHeld || kbFire;
    s.edge.fire = padFireEdge || kbFireEdge;
    s.edge.pause = pauseEdge || kbPauseEdge;

    this._kbFirePrev = kbFire;
    this._kbPausePrev = kbPause;
  }
}
