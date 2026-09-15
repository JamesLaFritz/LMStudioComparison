export class InputManager {
  constructor() {
    this.keys = {};
    this.prevKeys = {};
    this.gamepads = { axis: { horizontal: 0, vertical: 0 }, buttons: {} };
    this._boundOnKeyDown = this._onKeyDown.bind(this);
    this._boundOnKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._boundOnKeyDown);
    window.addEventListener('keyup', this._boundOnKeyUp);
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
  }

  update() {
    this.prevKeys = { ...this.keys };
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp) {
      const deadzone = 0.15;
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      this.gamepads.axis.horizontal = Math.abs(ax) > deadzone ? ax : 0;
      this.gamepads.axis.vertical = Math.abs(ay) > deadzone ? ay : 0;
      for (let i = 0; i < gp.buttons.length; i++) {
        this.gamepads.buttons[i] = gp.buttons[i].pressed;
      }
    }
  }

  getAxis(name) {
    let val = 0;
    if (name === 'horizontal') {
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) val -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) val += 1;
      const gp = this.gamepads.axis.horizontal;
      if (gp !== 0) val = gp;
    } else if (name === 'vertical') {
      if (this.keys['KeyW'] || this.keys['ArrowUp']) val += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) val -= 1;
      const gp = this.gamepads.axis.vertical;
      if (gp !== 0) val = gp;
    }
    return val;
  }

  getButton(name) {
    if (name === 'fire') {
      if (this.keys['Space']) return true;
      if (this.gamepads.buttons[0]) return true;
    }
    return false;
  }

  wasJustPressed(name) {
    if (name === 'fire') {
      const cur = this.keys['Space'] || false;
      const prev = this.prevKeys['Space'] || false;
      return cur && !prev;
    }
    return false;
  }

  dispose() {
    window.removeEventListener('keydown', this._boundOnKeyDown);
    window.removeEventListener('keyup', this._boundOnKeyUp);
  }
}
