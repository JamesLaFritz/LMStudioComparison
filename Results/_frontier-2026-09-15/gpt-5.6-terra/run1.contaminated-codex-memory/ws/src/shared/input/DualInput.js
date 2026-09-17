import { clearInputEdges, createInputFrame } from './InputFrame.js';

const MOVEMENT_LEFT = new Set(['ArrowLeft', 'KeyA']);
const MOVEMENT_RIGHT = new Set(['ArrowRight', 'KeyD']);
const FIRE_KEYS = new Set(['Space', 'Enter']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);
const RESTART_KEYS = new Set(['KeyR']);
const CONTROL_KEYS = new Set([
  ...MOVEMENT_LEFT, ...MOVEMENT_RIGHT, ...FIRE_KEYS, ...PAUSE_KEYS, ...RESTART_KEYS,
]);

/**
 * Keyboard and Gamepad API adapter. Held input and edge input are deliberately
 * separate so a tap between fixed updates remains visible to the simulation.
 */
export class DualInput {
  constructor({ target = globalThis.window, deadzone = 0.22, onGesture = null } = {}) {
    this.target = target;
    this.deadzone = deadzone;
    this.onGesture = onGesture;
    this.enabled = true;
    this._keys = new Set();
    this._latches = {
      firePressed: false,
      confirmPressed: false,
      pausePressed: false,
      restartPressed: false,
      anyPressed: false,
    };
    this._previousButtons = [];
    this._frame = createInputFrame();
    this._disposed = false;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onWindowBlur = this._onWindowBlur.bind(this);

    target?.addEventListener?.('keydown', this._onKeyDown, { passive: false });
    target?.addEventListener?.('keyup', this._onKeyUp);
    target?.addEventListener?.('blur', this._onWindowBlur);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.reset();
  }

  reset() {
    this._keys.clear();
    this._previousButtons.length = 0;
    for (const key of Object.keys(this._latches)) this._latches[key] = false;
    clearInputEdges(this._frame);
    this._frame.moveX = 0;
    this._frame.left = false;
    this._frame.right = false;
    this._frame.fire = false;
  }

  poll() {
    const frame = this._frame;
    clearInputEdges(frame);
    frame.gamepadConnected = false;

    if (!this.enabled || this._disposed) {
      frame.moveX = 0;
      frame.left = false;
      frame.right = false;
      frame.fire = false;
      return frame;
    }

    let gamepadMove = 0;
    let gamepadFire = false;
    const gamepad = this._getPrimaryGamepad();
    if (gamepad) {
      frame.gamepadConnected = true;
      gamepadMove = this._readGamepadMovement(gamepad);
      gamepadFire = this._buttonHeld(gamepad, 0) || this._buttonHeld(gamepad, 7);
      this._latchGamepadEdges(gamepad);
    } else {
      this._previousButtons.length = 0;
    }

    const left = this._isAnyDown(MOVEMENT_LEFT);
    const right = this._isAnyDown(MOVEMENT_RIGHT);
    const keyboardMove = Number(right) - Number(left);
    frame.moveX = Math.abs(gamepadMove) > Math.abs(keyboardMove) ? gamepadMove : keyboardMove;
    frame.left = frame.moveX < -0.01;
    frame.right = frame.moveX > 0.01;
    frame.fire = this._isAnyDown(FIRE_KEYS) || gamepadFire;

    for (const [key, value] of Object.entries(this._latches)) frame[key] = value;
    for (const key of Object.keys(this._latches)) this._latches[key] = false;
    return frame;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.target?.removeEventListener?.('keydown', this._onKeyDown);
    this.target?.removeEventListener?.('keyup', this._onKeyUp);
    this.target?.removeEventListener?.('blur', this._onWindowBlur);
    this.reset();
  }

  _onKeyDown(event) {
    if (!this.enabled || !CONTROL_KEYS.has(event.code)) return;
    if (isEditableTarget(event.target)) return;
    event.preventDefault?.();
    const wasDown = this._keys.has(event.code);
    this._keys.add(event.code);
    if (!wasDown && !event.repeat) {
      this._latchForCode(event.code);
      this._registerGesture();
    }
  }

  _onKeyUp(event) {
    if (!CONTROL_KEYS.has(event.code)) return;
    this._keys.delete(event.code);
  }

  _onWindowBlur() {
    this.reset();
  }

  _latchForCode(code) {
    this._latches.anyPressed = true;
    if (FIRE_KEYS.has(code)) {
      this._latches.firePressed = true;
      this._latches.confirmPressed = true;
    }
    if (PAUSE_KEYS.has(code)) this._latches.pausePressed = true;
    if (RESTART_KEYS.has(code)) this._latches.restartPressed = true;
  }

  _getPrimaryGamepad() {
    const pads = globalThis.navigator?.getGamepads?.();
    if (!pads) return null;
    for (const pad of pads) {
      if (pad?.connected) return pad;
    }
    return null;
  }

  _readGamepadMovement(gamepad) {
    const axis = Number(gamepad.axes?.[0] ?? 0);
    const dpad = Number(this._buttonHeld(gamepad, 15)) - Number(this._buttonHeld(gamepad, 14));
    const raw = Math.abs(dpad) > 0 ? dpad : axis;
    if (Math.abs(raw) <= this.deadzone) return 0;
    const normalized = (Math.abs(raw) - this.deadzone) / (1 - this.deadzone);
    return Math.sign(raw) * Math.min(1, normalized);
  }

  _latchGamepadEdges(gamepad) {
    const watched = [0, 7, 9];
    for (const index of watched) {
      const pressed = this._buttonHeld(gamepad, index);
      const wasPressed = this._previousButtons[index] === true;
      if (pressed && !wasPressed) {
        this._latches.anyPressed = true;
        if (index === 0 || index === 7) {
          this._latches.firePressed = true;
          this._latches.confirmPressed = true;
        }
        if (index === 9) this._latches.pausePressed = true;
        this._registerGesture();
      }
      this._previousButtons[index] = pressed;
    }
  }

  _buttonHeld(gamepad, index) {
    const button = gamepad.buttons?.[index];
    return Boolean(button?.pressed || (Number(button?.value) || 0) > 0.55);
  }

  _isAnyDown(keys) {
    for (const key of keys) {
      if (this._keys.has(key)) return true;
    }
    return false;
  }

  _registerGesture() {
    try {
      this.onGesture?.();
    } catch {
      // A rejected audio unlock must not break game controls.
    }
  }
}

function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const tagName = String(target.tagName || '').toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}
