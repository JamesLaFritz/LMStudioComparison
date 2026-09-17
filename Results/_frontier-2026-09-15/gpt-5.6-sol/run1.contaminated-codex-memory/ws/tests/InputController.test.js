import test from 'node:test';
import assert from 'node:assert/strict';
import { InputController } from '../src/shared/input/InputController.js';
import { INPUT_BINDINGS } from '../src/Space_Invaders/config.js';

class FakeWindow {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, fields = {}) {
    let prevented = false;
    const event = {
      target: { tagName: 'DIV' },
      repeat: false,
      preventDefault() {
        prevented = true;
      },
      ...fields,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return prevented;
  }
}

function createGamepad(index = 0) {
  return {
    index,
    connected: true,
    mapping: 'standard',
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  };
}

function createHarness() {
  const windowTarget = new FakeWindow();
  const gamepads = [];
  const input = new InputController({ bindings: INPUT_BINDINGS, windowTarget, getGamepads: () => gamepads });
  input.attach();
  return { input, windowTarget, gamepads };
}

test('keyboard edges are latched, repeats suppressed, and quick taps survive polling gaps', () => {
  const { input, windowTarget } = createHarness();
  assert.equal(windowTarget.emit('keydown', { code: 'Space' }), true);
  assert.equal(windowTarget.emit('keydown', { code: 'Space', repeat: true }), true);
  windowTarget.emit('keyup', { code: 'Space' });
  assert.equal(input.takePressed('fire'), true);
  assert.equal(input.takePressed('fire'), false);
  assert.equal(input.takeReleased('fire'), true);
  assert.equal(input.held('fire'), false);
  input.dispose();
});

test('keyboard movement cancels opposing keys and blur releases all state', () => {
  const { input, windowTarget } = createHarness();
  windowTarget.emit('keydown', { code: 'KeyA' });
  assert.equal(input.axis('moveX'), -1);
  windowTarget.emit('keydown', { code: 'KeyD' });
  assert.equal(input.axis('moveX'), 0);
  windowTarget.emit('keyup', { code: 'KeyA' });
  assert.equal(input.axis('moveX'), 1);
  windowTarget.emit('blur');
  assert.equal(input.axis('moveX'), 0);
  assert.equal(input.held('fire'), false);
  input.dispose();
});

test('gamepad deadzone curve and D-pad merge into moveX', () => {
  const { input, gamepads } = createHarness();
  const gamepad = createGamepad();
  gamepads[0] = gamepad;
  gamepad.axes[0] = 0.1;
  input.poll();
  assert.equal(input.axis('moveX'), 0);

  gamepad.axes[0] = 0.59;
  input.poll();
  const expected = ((0.59 - 0.18) / 0.82) ** 1.35;
  assert.ok(Math.abs(input.axis('moveX') - expected) < 1e-12);
  gamepad.buttons[14] = { pressed: true, value: 1 };
  input.poll();
  assert.equal(input.axis('moveX'), -1);
  assert.equal(input.lastInputKind, 'gamepad');
  input.dispose();
});

test('directional gamepad axes create menu button edges', () => {
  const { input, gamepads } = createHarness();
  const gamepad = createGamepad();
  gamepads[0] = gamepad;
  gamepad.axes[1] = -1;
  input.poll();
  assert.equal(input.takePressed('menuUp'), true);
  assert.equal(input.held('menuUp'), true);
  input.poll();
  assert.equal(input.takePressed('menuUp'), false);
  gamepad.axes[1] = 0;
  input.poll();
  assert.equal(input.takeReleased('menuUp'), true);
  input.dispose();
});

test('standard-mapped gamepads take precedence over connected fallback controllers', () => {
  const { input, gamepads } = createHarness();
  const fallback = createGamepad(0);
  fallback.mapping = '';
  fallback.axes[0] = -1;
  gamepads[0] = fallback;

  const standard = createGamepad(1);
  standard.axes[0] = 1;
  gamepads[1] = standard;

  input.poll();
  assert.equal(input.axis('moveX'), 1);
  input.dispose();
});

test('disconnect and gameplay gating neutralize gameplay actions without disabling menus', () => {
  const { input, windowTarget, gamepads } = createHarness();
  const gamepad = createGamepad();
  gamepads[0] = gamepad;
  gamepad.buttons[0] = { pressed: true, value: 1 };
  input.poll();
  assert.equal(input.held('fire'), true);
  input.setGameplayEnabled(false);
  assert.equal(input.held('fire'), false);
  assert.equal(input.takePressed('fire'), false);
  assert.equal(input.takePressed('confirm'), true, 'global/menu actions remain available');

  gamepad.buttons[0] = { pressed: false, value: 0 };
  input.poll();
  gamepad.buttons[0] = { pressed: true, value: 1 };
  input.poll();
  input.setGameplayEnabled(true);
  assert.equal(input.takePressed('fire'), false, 'gameplay edges are not buffered while menus own input');

  gamepads[0] = null;
  windowTarget.emit('gamepaddisconnected', { gamepad });
  input.poll();
  assert.equal(input.held('fire'), false);
  input.dispose();
});

test('editable targets are ignored and dispose removes listeners', () => {
  const { input, windowTarget } = createHarness();
  const prevented = windowTarget.emit('keydown', { code: 'Space', target: { tagName: 'INPUT' } });
  assert.equal(prevented, false);
  assert.equal(input.takePressed('fire'), false);
  input.dispose();
  windowTarget.emit('keydown', { code: 'Space' });
  assert.equal(input.takePressed('fire'), false);
});
