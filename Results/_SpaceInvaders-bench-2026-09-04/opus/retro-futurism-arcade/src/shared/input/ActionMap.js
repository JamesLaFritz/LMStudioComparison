/**
 * Action definitions and default bindings.
 *
 * Gameplay code asks for **actions** (`fire`, `moveX`), never for keys or
 * buttons. That indirection is what makes one code path serve both a keyboard
 * and a gamepad without a single conditional in the game itself, and it is what
 * would make rebinding a settings-menu change rather than a refactor.
 *
 * Two action kinds:
 *  - `axis`   — a float in [-1, 1], composed from opposing digital keys or an
 *               analog stick.
 *  - `button` — digital, with `pressed` / `held` / `released` edge states.
 */

/** Standard gamepad button indices (W3C Gamepad API "standard" mapping). */
export const PAD = Object.freeze({
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  HOME: 16
});

/**
 * @typedef {object} AxisBinding
 * @property {string[]} negativeKeys
 * @property {string[]} positiveKeys
 * @property {number[]} padAxes         analog axis indices
 * @property {number[]} padNegative     buttons pushing the axis negative
 * @property {number[]} padPositive     buttons pushing the axis positive
 */

/**
 * @typedef {object} ButtonBinding
 * @property {string[]} keys            `KeyboardEvent.code` values
 * @property {number[]} padButtons
 */

/**
 * Default bindings.
 *
 * `KeyboardEvent.code` is used throughout rather than `key`. `code` is the
 * physical key position, so WASD works unchanged on an AZERTY or Dvorak layout,
 * where `key` would report 'z', 'q', 's', 'd' and silently break movement for a
 * large fraction of players.
 */
export const DEFAULT_BINDINGS = Object.freeze({
  axes: {
    moveX: {
      negativeKeys: ['KeyA', 'ArrowLeft'],
      positiveKeys: ['KeyD', 'ArrowRight'],
      padAxes: [0],
      padNegative: [PAD.DPAD_LEFT],
      padPositive: [PAD.DPAD_RIGHT]
    },
    moveY: {
      negativeKeys: ['KeyS', 'ArrowDown'],
      positiveKeys: ['KeyW', 'ArrowUp'],
      padAxes: [1],
      padNegative: [PAD.DPAD_DOWN],
      padPositive: [PAD.DPAD_UP],
      invertPadAxis: true
    }
  },

  buttons: {
    // Fire is bound generously: space, up, W, the south face button, and both
    // triggers. A player's first instinct for "shoot" varies enormously and
    // there is no cost to accepting all of them.
    fire: {
      keys: ['Space', 'KeyW', 'ArrowUp', 'KeyJ'],
      padButtons: [PAD.A, PAD.RT, PAD.RB, PAD.X]
    },
    pause: {
      keys: ['Escape', 'KeyP'],
      padButtons: [PAD.START]
    },
    confirm: {
      keys: ['Enter', 'Space', 'NumpadEnter'],
      padButtons: [PAD.A]
    },
    back: {
      keys: ['Escape', 'Backspace'],
      padButtons: [PAD.B]
    },
    restart: {
      keys: ['KeyR'],
      padButtons: [PAD.Y]
    },
    debug: {
      keys: ['F3'],
      padButtons: []
    },
    quality: {
      keys: ['F2'],
      padButtons: []
    }
  }
});

/** Every key the game consumes. Used to decide what to `preventDefault`. */
export function collectBoundKeys(bindings = DEFAULT_BINDINGS) {
  const keys = new Set();
  for (const axis of Object.values(bindings.axes)) {
    for (const k of axis.negativeKeys) keys.add(k);
    for (const k of axis.positiveKeys) keys.add(k);
  }
  for (const button of Object.values(bindings.buttons)) {
    for (const k of button.keys) keys.add(k);
  }
  return keys;
}

/**
 * Deep-clone the defaults so a game can customise bindings without mutating the
 * shared table — a mistake that would silently change the controls of every
 * other cabinet in the session.
 */
export function cloneBindings(bindings = DEFAULT_BINDINGS) {
  return {
    axes: Object.fromEntries(
      Object.entries(bindings.axes).map(([name, b]) => [
        name,
        {
          negativeKeys: [...b.negativeKeys],
          positiveKeys: [...b.positiveKeys],
          padAxes: [...b.padAxes],
          padNegative: [...b.padNegative],
          padPositive: [...b.padPositive],
          invertPadAxis: !!b.invertPadAxis
        }
      ])
    ),
    buttons: Object.fromEntries(
      Object.entries(bindings.buttons).map(([name, b]) => [
        name,
        { keys: [...b.keys], padButtons: [...b.padButtons] }
      ])
    )
  };
}
