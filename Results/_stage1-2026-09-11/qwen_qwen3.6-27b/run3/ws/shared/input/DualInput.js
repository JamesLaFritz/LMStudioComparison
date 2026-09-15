export class DualInput {
  constructor() {
    this._keys = new Set();
    this._gamepadIndex = null;
    this._axes = { left: 0, right: 0, up: 0, down: 0, fire: 0, special: 0 };
    this._keyMap = {
      KeyW: 'up', ArrowUp: 'up',
      KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      Space: 'fire', KeyJ: 'fire', KeyZ: 'fire',
      KeyE: 'special', KeyX: 'special', KeyShift: 'special', ShiftLeft: 'special', ShiftRight: 'special'
    };
    this._bindKeyboard();
    this._bindGamepad();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this._keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
    });
  }

  _bindGamepad() {
    window.addEventListener('gamepadconnected', (e) => {
      this._gamepadIndex = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index === this._gamepadIndex) {
        this._gamepadIndex = null;
      }
    });
  }

  poll() {
    const a = this._axes;
    a.left = 0; a.right = 0; a.up = 0; a.down = 0; a.fire = 0; a.special = 0;

    // Keyboard
    for (const key of this._keys) {
      const axis = this._keyMap[key];
      if (axis === 'left') a.left = 1;
      else if (axis === 'right') a.right = 1;
      else if (axis === 'up') a.up = 1;
      else if (axis === 'down') a.down = 1;
      else if (axis === 'fire') a.fire = 1;
      else if (axis === 'special') a.special = 1;
    }

    // Gamepad (adds to keyboard, gamepad takes priority via clamping)
    if (this._gamepadIndex !== null) {
      const gp = navigator.getGamepads()[this._gamepadIndex];
      if (gp) {
        const deadzone = 0.15;
        const lx = gp.axes[0] || 0;
        const ly = gp.axes[1] || 0;
        if (Math.abs(lx) > deadzone) {
          if (lx < 0) a.left = Math.min(1, a.left + Math.abs(lx));
          else a.right = Math.min(1, a.right + lx);
        }
        if (Math.abs(ly) > deadzone) {
          if (ly < 0) a.up = Math.min(1, a.up + Math.abs(ly));
          else a.down = Math.min(1, a.down + ly);
        }
        if (gp.buttons[0] && gp.buttons[0].pressed) a.fire = Math.min(1, a.fire + 1);
        if (gp.buttons[2] && gp.buttons[2].pressed) a.special = Math.min(1, a.special + 1);
      }
    }

    // Clamp to 0 or 1 (digital)
    for (const k in a) a[k] = Math.round(Math.min(1, a[k]));

    return a;
  }

  get axis() {
    return this._axes;
  }
}
