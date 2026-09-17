const DEFAULT_DEADZONE = 0.18;

function asArray(value) {
  if (Array.isArray(value)) return value.slice();
  if (value === undefined || value === null) return [];
  return [value];
}

function normalizeAxisDescriptor(value) {
  if (typeof value === 'number') return { index: value, direction: 0 };
  if (!value || typeof value !== 'object') return { index: -1, direction: 0 };
  return {
    index: Number.isInteger(value.index) ? value.index : -1,
    direction: value.direction === -1 || value.direction === 1 ? value.direction : 0,
  };
}

function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable) return true;
  const tag = String(target.tagName ?? '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function buttonPressed(button) {
  if (typeof button === 'number') return button > 0.5;
  return Boolean(button?.pressed || Number(button?.value ?? 0) > 0.5);
}

function applyDeadzone(value, deadzone) {
  const magnitude = Math.abs(value);
  if (!Number.isFinite(magnitude) || magnitude <= deadzone) return 0;
  const normalized = Math.min(1, (magnitude - deadzone) / (1 - deadzone));
  return Math.sign(value) * normalized ** 1.35;
}

function gamepadAtIndex(gamepads, index) {
  if (index === null) return null;
  const direct = gamepads[index];
  if (direct && direct.connected !== false && (direct.index ?? index) === index) return direct;
  for (let slot = 0; slot < gamepads.length; slot += 1) {
    const candidate = gamepads[slot];
    if (candidate && candidate.connected !== false && candidate.index === index) return candidate;
  }
  return null;
}

function gamepadIndex(gamepads, gamepad) {
  if (Number.isInteger(gamepad?.index)) return gamepad.index;
  for (let slot = 0; slot < gamepads.length; slot += 1) {
    if (gamepads[slot] === gamepad) return slot;
  }
  return null;
}

function inferGameplayAction(name, descriptor) {
  if (typeof descriptor.gameplay === 'boolean') return descriptor.gameplay;
  if (descriptor.scope === 'ui' || descriptor.scope === 'global') return false;
  return name === 'moveX' || name === 'fire' || /^move/i.test(name) || /^shoot/i.test(name);
}

function normalizeBindings(bindings) {
  if (!bindings || typeof bindings !== 'object') throw new TypeError('bindings must be an object or Map');
  const entries = bindings instanceof Map ? bindings.entries() : Object.entries(bindings);
  const records = [];
  for (const [name, descriptorValue] of entries) {
    const descriptor = descriptorValue ?? {};
    const negativeKeys = asArray(descriptor.negativeKeys ?? descriptor.keyboardNegative ?? descriptor.keys?.negative);
    const positiveKeys = asArray(descriptor.positiveKeys ?? descriptor.keyboardPositive ?? descriptor.keys?.positive);
    const axisDescriptor = normalizeAxisDescriptor(descriptor.gamepadAxis ?? descriptor.axis);
    const buttonKeys = asArray(descriptor.keys ?? descriptor.keyboard);
    const kind = descriptor.type === 'axis' || negativeKeys.length > 0 || positiveKeys.length > 0 ||
      (axisDescriptor.index >= 0 && axisDescriptor.direction === 0 && buttonKeys.length === 0)
      ? 'axis'
      : 'button';
    records.push({
      name,
      kind,
      keys: kind === 'button' ? buttonKeys : [],
      negativeKeys,
      positiveKeys,
      gamepadButtons: asArray(descriptor.gamepadButtons ?? descriptor.buttons),
      negativeButtons: asArray(descriptor.negativeButtons ?? descriptor.gamepadNegativeButtons),
      positiveButtons: asArray(descriptor.positiveButtons ?? descriptor.gamepadPositiveButtons),
      axisIndex: axisDescriptor.index,
      axisDirection: axisDescriptor.direction,
      deadzone: Number.isFinite(descriptor.deadzone)
        ? Math.max(0, Math.min(0.95, descriptor.deadzone))
        : DEFAULT_DEADZONE,
      gameplay: inferGameplayAction(name, descriptor),
      keyboardHeld: false,
      gamepadHeld: false,
      gamepadAxisValue: 0,
      held: false,
      axisValue: 0,
      pendingPressed: false,
      pendingReleased: false,
    });
  }
  return records;
}

/** Unified keyboard/Gamepad API action mapper with latched edge events. */
export class InputController {
  constructor({
    bindings,
    windowTarget = globalThis.window,
    getGamepads = () => globalThis.navigator?.getGamepads?.() ?? [],
  } = {}) {
    if (typeof getGamepads !== 'function') throw new TypeError('getGamepads must be a function');
    this._window = windowTarget;
    this._getGamepads = getGamepads;
    this._records = normalizeBindings(bindings);
    this._byName = new Map(this._records.map((record) => [record.name, record]));
    this._keysDown = new Set();
    this._attached = false;
    this._disposed = false;
    this._gameplayEnabled = true;
    this._gamepadIndex = null;
    this._lastInputKind = 'keyboard';

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onGamepadConnected = this._onGamepadConnected.bind(this);
    this._onGamepadDisconnected = this._onGamepadDisconnected.bind(this);
  }

  get lastInputKind() {
    return this._lastInputKind;
  }

  attach() {
    if (this._disposed) throw new Error('Cannot attach a disposed InputController');
    if (this._attached) return false;
    if (!this._window || typeof this._window.addEventListener !== 'function') {
      throw new TypeError('windowTarget must implement addEventListener');
    }
    this._window.addEventListener('keydown', this._onKeyDown, { passive: false });
    this._window.addEventListener('keyup', this._onKeyUp, { passive: false });
    this._window.addEventListener('blur', this._onBlur);
    this._window.addEventListener('gamepadconnected', this._onGamepadConnected);
    this._window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
    this._attached = true;
    return true;
  }

  poll() {
    if (this._disposed) return;
    let gamepads;
    try {
      gamepads = this._getGamepads() ?? [];
    } catch {
      gamepads = [];
    }

    let selected = gamepadAtIndex(gamepads, this._gamepadIndex);
    if (selected?.mapping !== 'standard') {
      for (let index = 0; index < gamepads.length; index += 1) {
        const candidate = gamepads[index];
        if (candidate && candidate.connected !== false && candidate.mapping === 'standard') {
          selected = candidate;
          break;
        }
      }
    }
    if (!selected) {
      for (let index = 0; index < gamepads.length; index += 1) {
        const candidate = gamepads[index];
        if (candidate && candidate.connected !== false) {
          selected = candidate;
          break;
        }
      }
    }
    this._gamepadIndex = gamepadIndex(gamepads, selected);

    let gamepadWasActive = false;
    for (const record of this._records) {
      if (record.kind === 'axis') {
        let axisValue = 0;
        if (selected && record.axisIndex >= 0) {
          const raw = Number(selected.axes?.[record.axisIndex] ?? 0);
          axisValue = applyDeadzone(raw, record.deadzone);
          if (record.axisDirection !== 0) axisValue = Math.max(0, axisValue * record.axisDirection);
        }
        let buttonAxis = 0;
        if (selected) {
          for (const index of record.negativeButtons) {
            if (buttonPressed(selected.buttons?.[index])) buttonAxis -= 1;
          }
          for (const index of record.positiveButtons) {
            if (buttonPressed(selected.buttons?.[index])) buttonAxis += 1;
          }
        }
        buttonAxis = Math.max(-1, Math.min(1, buttonAxis));
        const gamepadAxis = Math.abs(buttonAxis) >= Math.abs(axisValue) ? buttonAxis : axisValue;
        record.gamepadAxisValue = gamepadAxis;
        const keyboardAxis = this._keyboardAxis(record);
        record.axisValue = Math.abs(keyboardAxis) >= Math.abs(gamepadAxis) ? keyboardAxis : gamepadAxis;
        record.gamepadHeld = Math.abs(gamepadAxis) > 0;
        this._applyCombinedHeld(record, Math.abs(record.axisValue) > 0);
        if (Math.abs(gamepadAxis) > 0.01) gamepadWasActive = true;
      } else {
        let gamepadHeld = false;
        if (selected) {
          for (const index of record.gamepadButtons) {
            if (buttonPressed(selected.buttons?.[index])) {
              gamepadHeld = true;
              gamepadWasActive = true;
              break;
            }
          }
          if (!gamepadHeld && record.axisIndex >= 0 && record.axisDirection !== 0) {
            const raw = Number(selected.axes?.[record.axisIndex] ?? 0);
            const directional = applyDeadzone(raw, record.deadzone) * record.axisDirection;
            gamepadHeld = directional > 0.5;
            if (gamepadHeld) gamepadWasActive = true;
          }
        }
        record.gamepadHeld = gamepadHeld;
        this._applyCombinedHeld(record, record.keyboardHeld || record.gamepadHeld);
      }
    }
    if (gamepadWasActive) this._lastInputKind = 'gamepad';
  }

  axis(name) {
    const record = this._byName.get(name);
    if (!record || record.kind !== 'axis' || (!this._gameplayEnabled && record.gameplay)) return 0;
    return record.axisValue;
  }

  held(name) {
    const record = this._byName.get(name);
    if (!record || (!this._gameplayEnabled && record.gameplay)) return false;
    return record.kind === 'axis' ? Math.abs(record.axisValue) > 0 : record.held;
  }

  takePressed(name) {
    const record = this._byName.get(name);
    if (!record || (!this._gameplayEnabled && record.gameplay)) return false;
    const pending = record.pendingPressed;
    record.pendingPressed = false;
    return pending;
  }

  takeReleased(name) {
    const record = this._byName.get(name);
    if (!record || (!this._gameplayEnabled && record.gameplay)) return false;
    const pending = record.pendingReleased;
    record.pendingReleased = false;
    return pending;
  }

  async pulseGamepad(options = {}) {
    let gamepads;
    try {
      gamepads = this._getGamepads() ?? [];
    } catch {
      return false;
    }
    const gamepad = gamepadAtIndex(gamepads, this._gamepadIndex);
    if (!gamepad) return false;

    const duration = Math.max(0, Math.min(1000, Number(options.duration ?? 60)));
    const strongMagnitude = Math.max(0, Math.min(1, Number(options.strongMagnitude ?? options.strong ?? 0.5)));
    const weakMagnitude = Math.max(0, Math.min(1, Number(options.weakMagnitude ?? options.weak ?? 0.5)));
    try {
      if (typeof gamepad.vibrationActuator?.playEffect === 'function') {
        await gamepad.vibrationActuator.playEffect('dual-rumble', {
          duration,
          startDelay: 0,
          strongMagnitude,
          weakMagnitude,
        });
        return true;
      }
      const actuator = gamepad.hapticActuators?.[0];
      if (typeof actuator?.pulse === 'function') {
        await actuator.pulse(Math.max(strongMagnitude, weakMagnitude), duration);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  releaseAll() {
    this._keysDown.clear();
    for (const record of this._records) {
      record.keyboardHeld = false;
      record.gamepadHeld = false;
      record.gamepadAxisValue = 0;
      record.held = false;
      record.axisValue = 0;
      record.pendingPressed = false;
      record.pendingReleased = false;
    }
  }

  setGameplayEnabled(value) {
    const enabled = Boolean(value);
    if (enabled === this._gameplayEnabled) return false;
    this._gameplayEnabled = enabled;
    if (!enabled) {
      for (const record of this._records) {
        if (record.gameplay) {
          record.pendingPressed = false;
          record.pendingReleased = false;
        }
      }
    }
    return true;
  }

  dispose() {
    if (this._disposed) return;
    if (this._attached) {
      this._window.removeEventListener('keydown', this._onKeyDown);
      this._window.removeEventListener('keyup', this._onKeyUp);
      this._window.removeEventListener('blur', this._onBlur);
      this._window.removeEventListener('gamepadconnected', this._onGamepadConnected);
      this._window.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);
      this._attached = false;
    }
    this.releaseAll();
    this._disposed = true;
    this._byName.clear();
    this._records.length = 0;
    this._window = null;
    this._getGamepads = () => [];
  }

  _onKeyDown(event) {
    if (!event?.code || isEditableTarget(event.target)) return;
    const relevant = this._isBoundCode(event.code);
    if (!relevant) return;
    event.preventDefault?.();
    this._lastInputKind = 'keyboard';
    if (event.repeat || this._keysDown.has(event.code)) return;
    this._keysDown.add(event.code);
    this._refreshKeyboardRecords(event.code);
  }

  _onKeyUp(event) {
    if (!event?.code) return;
    const relevant = this._isBoundCode(event.code);
    if (!relevant) return;
    const wasHeldByGame = this._keysDown.has(event.code);
    if (!wasHeldByGame && isEditableTarget(event.target)) return;
    if (!isEditableTarget(event.target)) event.preventDefault?.();
    this._lastInputKind = 'keyboard';
    this._keysDown.delete(event.code);
    this._refreshKeyboardRecords(event.code);
  }

  _onBlur() {
    this.releaseAll();
  }

  _onGamepadConnected(event) {
    if (!event?.gamepad || !Number.isInteger(event.gamepad.index)) return;
    if (this._gamepadIndex === null) this._gamepadIndex = event.gamepad.index;
  }

  _onGamepadDisconnected(event) {
    if (!event?.gamepad || event.gamepad.index === this._gamepadIndex) {
      this._gamepadIndex = null;
      for (const record of this._records) {
        record.gamepadHeld = false;
        if (record.kind === 'axis') {
          record.gamepadAxisValue = 0;
          record.axisValue = this._keyboardAxis(record);
        }
        this._applyCombinedHeld(record, record.kind === 'axis' ? Math.abs(record.axisValue) > 0 : record.keyboardHeld);
      }
    }
  }

  _isBoundCode(code) {
    for (const record of this._records) {
      if (record.keys.includes(code) || record.negativeKeys.includes(code) || record.positiveKeys.includes(code)) return true;
    }
    return false;
  }

  _refreshKeyboardRecords(code) {
    for (const record of this._records) {
      if (record.kind === 'axis') {
        if (!record.negativeKeys.includes(code) && !record.positiveKeys.includes(code)) continue;
        const keyboardAxis = this._keyboardAxis(record);
        const gamepadAxis = record.gamepadAxisValue;
        record.axisValue = Math.abs(keyboardAxis) >= Math.abs(gamepadAxis) ? keyboardAxis : gamepadAxis;
        record.keyboardHeld = keyboardAxis !== 0;
        this._applyCombinedHeld(record, Math.abs(record.axisValue) > 0);
      } else {
        if (!record.keys.includes(code)) continue;
        record.keyboardHeld = record.keys.some((key) => this._keysDown.has(key));
        this._applyCombinedHeld(record, record.keyboardHeld || record.gamepadHeld);
      }
    }
  }

  _keyboardAxis(record) {
    let value = 0;
    for (const key of record.negativeKeys) {
      if (this._keysDown.has(key)) value -= 1;
    }
    for (const key of record.positiveKeys) {
      if (this._keysDown.has(key)) value += 1;
    }
    return Math.max(-1, Math.min(1, value));
  }

  _applyCombinedHeld(record, nextHeld) {
    const normalized = Boolean(nextHeld);
    if (normalized === record.held) return;
    record.held = normalized;
    if (record.gameplay && !this._gameplayEnabled) {
      record.pendingPressed = false;
      record.pendingReleased = false;
      return;
    }
    if (normalized) record.pendingPressed = true;
    else record.pendingReleased = true;
  }
}
