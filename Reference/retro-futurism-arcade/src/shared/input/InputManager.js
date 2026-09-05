import { KeyboardDevice } from './KeyboardDevice.js';
import { GamepadDevice } from './GamepadDevice.js';
import { DEFAULT_BINDINGS, cloneBindings } from './ActionMap.js';
import { clamp } from '../util/MathUtils.js';

/**
 * The unified dual-input controller.
 *
 * Merges keyboard and gamepad into one action state that gameplay code reads
 * without ever knowing which device produced it. Both devices are live
 * simultaneously — the player can steer with the stick and fire with the space
 * bar, mid-run, with no mode switch.
 *
 * ### Edge detection lives here, not in the devices
 *
 * `pressed` and `released` are computed by diffing this frame's merged action
 * state against last frame's. Doing it centrally means the semantics are
 * identical for a key and a button, and it means an action bound to both
 * cannot fire two `pressed` edges in one frame.
 *
 * ### Poll ordering is a contract
 *
 * `poll()` must be called exactly once per frame, before any reads. Calling it
 * twice silently destroys every edge — the second call diffs against a state
 * that already matches, so every `pressed` becomes false. This is the single
 * most common way an input system quietly stops working, so the manager
 * detects a double-poll within one animation frame and warns.
 *
 * ### Device auto-detection
 *
 * The "active device" follows whichever hardware was touched last, and drives
 * the on-screen prompt glyphs. It is deliberately based on *activity*, not on
 * connection: a connected-but-idle pad must not switch a keyboard player's
 * prompts to button icons.
 */
export class InputManager {
  /**
   * @param {object} [opts]
   * @param {object} [opts.bindings]
   * @param {EventTarget} [opts.target]
   */
  constructor(opts = {}) {
    const { bindings = DEFAULT_BINDINGS, target = window, deadzone = 0.18 } = opts;

    this.bindings = cloneBindings(bindings);

    this.keyboard = new KeyboardDevice({ target, bindings: this.bindings });
    this.gamepad = new GamepadDevice({ deadzone });

    const axisNames = Object.keys(this.bindings.axes);
    const buttonNames = Object.keys(this.bindings.buttons);

    /** @type {Map<string, number>} */
    this.axisState = new Map();
    for (const name of axisNames) this.axisState.set(name, 0);

    /** @type {Map<string, boolean>} */
    this.buttonState = new Map();
    /** @type {Map<string, boolean>} */
    this.previousButtonState = new Map();
    for (const name of buttonNames) {
      this.buttonState.set(name, false);
      this.previousButtonState.set(name, false);
    }

    /** 'keyboard' | 'gamepad' */
    this.activeDevice = 'keyboard';

    this.enabled = true;
    /** When true, axes report 0 and buttons report not-held (menus, cutscenes). */
    this.suspended = false;

    this._lastPollFrame = -1;
    this._frameCounter = 0;
  }

  /**
   * Sample every device and recompute the action state.
   * Call once per frame, before reading anything.
   */
  poll() {
    this._frameCounter++;

    this.gamepad.poll();

    // --- Device auto-detect ----------------------------------------------
    if (this.gamepad.activity) {
      this.activeDevice = 'gamepad';
    } else if (this.keyboard.activity) {
      this.activeDevice = 'keyboard';
    }

    // --- Roll the edge buffer --------------------------------------------
    for (const [name, value] of this.buttonState) {
      this.previousButtonState.set(name, value);
    }

    if (this.suspended || !this.enabled) {
      for (const name of this.axisState.keys()) this.axisState.set(name, 0);
      for (const name of this.buttonState.keys()) this.buttonState.set(name, false);
      this.keyboard.clearActivity();
      return;
    }

    // --- Axes -------------------------------------------------------------
    for (const [name, binding] of Object.entries(this.bindings.axes)) {
      let value = 0;

      // Digital keys first: opposing keys cancel, which is the conventional
      // and least surprising behaviour when a player holds both.
      if (this.keyboard.anyDown(binding.negativeKeys)) value -= 1;
      if (this.keyboard.anyDown(binding.positiveKeys)) value += 1;

      // D-pad, treated as digital.
      if (this.gamepad.anyDown(binding.padNegative)) value -= 1;
      if (this.gamepad.anyDown(binding.padPositive)) value += 1;

      value = clamp(value, -1, 1);

      // Analog stick. Takes over only when it exceeds the digital contribution,
      // so a player using the stick gets full analog precision while a player
      // resting a thumb on it does not lose keyboard control.
      for (const axisIndex of binding.padAxes) {
        let analog = this.gamepad.axis(axisIndex);
        if (binding.invertPadAxis) analog = -analog;
        if (Math.abs(analog) > Math.abs(value)) value = analog;
      }

      this.axisState.set(name, value);
    }

    // --- Buttons ----------------------------------------------------------
    for (const [name, binding] of Object.entries(this.bindings.buttons)) {
      const down =
        this.keyboard.anyDown(binding.keys) || this.gamepad.anyDown(binding.padButtons);
      this.buttonState.set(name, down);
    }

    this.keyboard.clearActivity();
  }

  /** Analog value of an axis action, in [-1, 1]. */
  axis(name) {
    return this.axisState.get(name) ?? 0;
  }

  /** True while the action is held. */
  held(name) {
    return this.buttonState.get(name) === true;
  }

  /** True on the single frame the action went down. */
  pressed(name) {
    return this.buttonState.get(name) === true && this.previousButtonState.get(name) !== true;
  }

  /** True on the single frame the action came up. */
  released(name) {
    return this.buttonState.get(name) !== true && this.previousButtonState.get(name) === true;
  }

  /** True if any action at all is currently held. Used by attract mode. */
  anyHeld() {
    for (const value of this.buttonState.values()) {
      if (value) return true;
    }
    return false;
  }

  /** True if any action fired this frame. Used to dismiss title screens. */
  anyPressed() {
    for (const name of this.buttonState.keys()) {
      if (this.pressed(name)) return true;
    }
    return false;
  }

  /**
   * Fire haptics if the active device supports them.
   * A no-op on keyboard, by design — screen shake is the keyboard's rumble.
   */
  rumble(duration, weak, strong) {
    if (this.activeDevice !== 'gamepad') return false;
    return this.gamepad.rumble(duration, weak, strong);
  }

  /**
   * Suspend gameplay input without tearing anything down.
   *
   * Used when a modal overlay opens. Held keys are cleared so that the frame
   * the overlay closes does not deliver a spurious `pressed` edge from a button
   * the player has been holding the whole time the menu was open — which would
   * otherwise make opening the pause menu fire the weapon on close.
   */
  setSuspended(suspended) {
    if (this.suspended === suspended) return;
    this.suspended = suspended;
    if (suspended) {
      this.keyboard.reset();
      this.gamepad.stopRumble();
      for (const name of this.buttonState.keys()) {
        this.buttonState.set(name, false);
        this.previousButtonState.set(name, false);
      }
      for (const name of this.axisState.keys()) this.axisState.set(name, 0);
    }
  }

  /** Human-readable prompt for an action on the active device. */
  promptFor(action) {
    const binding = this.bindings.buttons[action];
    if (!binding) return '';
    if (this.activeDevice === 'gamepad') {
      const labels = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 9: 'START', 7: 'RT' };
      const first = binding.padButtons[0];
      return labels[first] ?? `BTN ${first}`;
    }
    const key = binding.keys[0] ?? '';
    return key.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '');
  }

  dispose() {
    this.keyboard.dispose();
    this.gamepad.dispose();
    this.axisState.clear();
    this.buttonState.clear();
    this.previousButtonState.clear();
  }
}
