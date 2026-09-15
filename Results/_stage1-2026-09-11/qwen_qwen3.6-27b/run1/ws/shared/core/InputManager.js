export class InputManager {
  constructor() {
    this._keys = {};
    this._prevKeys = {};
    this._gamepads = [];
    this._deadzone = 0.15;
    this._bindings = new Map();
    this._buttonStates = {};
    this._prevButtonStates = {};
    this._axisValues = {};

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this._setupDefaultBindings();
  }

  _setupDefaultBindings() {
    this._bindAxis('moveX', {
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD']
    });
    this._bindAxis('moveY', {
      up: ['ArrowUp', 'KeyW'],
      down: ['ArrowDown', 'KeyS']
    });

    this._bindButton('fire', ['Space', 'KeyJ', 'KeyZ']);
    this._bindButton('pause', ['Escape', 'KeyP']);
    this._bindButton('confirm', ['Enter', 'KeyK', 'KeyX']);
    this._bindButton('menu', ['KeyM']);
  }

  _bindAxis(name, { left, right }) {
    this._bindings.set('axis:' + name, { type: 'axis', left, right });
  }

  _bindButton(name, keys) {
    this._bindings.set('button:' + name, { type: 'button', keys });
  }

  _onKeyDown(e) {
    this._keys[e.code] = true;
    e.preventDefault();
  }

  _onKeyUp(e) {
    this._keys[e.code] = false;
    e.preventDefault();
  }

  _clampAxis(value) {
    if (Math.abs(value) < this._deadzone) return 0;
    return value;
  }

  _pollGamepads() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    this._gamepads = [];
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        this._gamepads.push(gamepads[i]);
      }
    }
  }

  update() {
    this._pollGamepads();

    this._prevKeys = { ...this._keys };
    this._prevButtonStates = { ...this._buttonStates };

    for (const [key, binding] of this._bindings) {
      if (binding.type === 'axis') {
        this._resolveAxis(key, binding);
      } else if (binding.type === 'button') {
        this._resolveButton(key, binding);
      }
    }
  }

  _resolveAxis(key, binding) {
    const axisName = key.replace('axis:', '');
    let value = 0;

    if (binding.left) {
      for (const k of binding.left) {
        if (this._keys[k]) { value -= 1; break; }
      }
    }
    if (binding.right) {
      for (const k of binding.right) {
        if (this._keys[k]) { value += 1; break; }
      }
    }

    if (this._gamepads.length > 0) {
      const gp = this._gamepads[0];
      if (gp.axes.length >= 2) {
        const gpValue = -gp.axes[0];
        if (Math.abs(gpValue) > this._deadzone) {
          value = gpValue;
        }
      }
    }

    this._axisValues[axisName] = this._clampAxis(value);
  }

  _resolveButton(key, binding) {
    const buttonName = key.replace('button:', '');
    let pressed = false;

    if (binding.keys) {
      for (const k of binding.keys) {
        if (this._keys[k]) { pressed = true; break; }
      }
    }

    if (!pressed && this._gamepads.length > 0) {
      const buttons = this._gamepads[0].buttons;
      const gamepadButtonMap = {
        'fire': [0, 7],
        'pause': [9],
        'confirm': [0],
        'menu': [6]
      };
      const gpButtons = gamepadButtonMap[buttonName];
      if (gpButtons) {
        for (const btn of gpButtons) {
          if (buttons[btn] && buttons[btn].pressed) {
            pressed = true;
            break;
          }
        }
      }
    }

    this._buttonStates[buttonName] = pressed;
  }

  getAxis(name) {
    return this._axisValues[name] || 0;
  }

  getButton(name) {
    return !!this._buttonStates[name];
  }

  isPressed(name) {
    return !!this._buttonStates[name];
  }

  isJustPressed(name) {
    return !!this._buttonStates[name] && !this._prevButtonStates[name];
  }

  isRawKeyDown(code) {
    return !!this._keys[code];
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
