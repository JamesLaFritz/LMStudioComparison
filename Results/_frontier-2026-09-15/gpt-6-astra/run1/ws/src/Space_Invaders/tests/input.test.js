import test from "node:test";
import assert from "node:assert/strict";
import { InputController } from "../../shared/core/InputController.js";
function key(target, type, code, repeat = false) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, "code", { value: code });
  Object.defineProperty(event, "repeat", { value: repeat });
  target.dispatchEvent(event);
}
function pad() {
  return {
    connected: true,
    mapping: "standard",
    axes: [0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}
test("short keyboard taps survive between render frames and do not repeat", () => {
  const target = new EventTarget(),
    input = new InputController({
      eventTarget: target,
      readGamepads: () => [],
    });
  key(target, "keydown", "Escape");
  key(target, "keyup", "Escape");
  assert.equal(input.sample().pausePressed, true);
  assert.equal(input.sample().pausePressed, false);
  key(target, "keydown", "Enter");
  key(target, "keyup", "Enter");
  assert.equal(input.sample().confirmPressed, true);
  key(target, "keydown", "KeyA");
  assert.equal(input.sample().moveX, -1);
  key(target, "keydown", "KeyD");
  assert.equal(input.sample().moveX, 0);
  key(target, "keyup", "KeyA");
  assert.equal(input.sample().moveX, 1);
  input.dispose();
});
test("gamepad dead zones, held fire, release gating and disconnection", () => {
  const target = new EventTarget(),
    p = pad(),
    pads = [p],
    input = new InputController({
      eventTarget: target,
      readGamepads: () => pads,
    });
  p.axes[0] = 0.18;
  assert.equal(input.sample().moveX, 0);
  p.axes[0] = 0.59;
  assert.ok(Math.abs(input.sample().moveX - 0.5) < 1e-8);
  p.buttons[0].pressed = true;
  assert.equal(input.sample().fire, true);
  assert.equal(input.sample().confirmPressed, false);
  input.requireRelease();
  assert.equal(input.sample().fire, false);
  p.buttons[0].pressed = false;
  input.sample();
  p.buttons[0].pressed = true;
  assert.equal(input.sample().fire, true);
  pads[0] = null;
  assert.equal(input.sample().disconnected, true);
  assert.equal(input.sample().moveX, 0);
  assert.equal(input.sample().disconnected, false);
  input.dispose();
});
test("pause clearing cannot retrigger held keyboard or controller buttons", () => {
  const target = new EventTarget(),
    p = pad();
  const input = new InputController({
    eventTarget: target,
    readGamepads: () => [p],
  });
  key(target, "keydown", "Escape");
  assert.equal(input.sample().pausePressed, true);
  input.clear();
  key(target, "keydown", "Escape", true);
  assert.equal(input.sample().pausePressed, false);
  key(target, "keyup", "Escape");
  key(target, "keydown", "Escape");
  assert.equal(input.sample().pausePressed, true);
  key(target, "keyup", "Escape");
  input.sample();
  p.buttons[9].pressed = true;
  assert.equal(input.sample().pausePressed, true);
  input.clear();
  assert.equal(input.sample().pausePressed, false);
  p.buttons[9].pressed = false;
  input.sample();
  p.buttons[9].pressed = true;
  assert.equal(input.sample().pausePressed, true);
  input.dispose();
});
test("virtual pointers release independently and unknown controllers are ignored", () => {
  const p = pad();
  p.mapping = "";
  p.axes[0] = 1;
  const input = new InputController({
    eventTarget: new EventTarget(),
    readGamepads: () => [null, p],
  });
  assert.equal(input.sample().moveX, 0);
  input.setVirtual("left", true, 1);
  input.setVirtual("fire", true, 2);
  assert.equal(input.sample().fire, true);
  assert.equal(input.sample().moveX, -1);
  input.setVirtual("left", false, 1);
  assert.equal(input.sample().moveX, 0);
  assert.equal(input.sample().fire, true);
  input.clear();
  assert.equal(input.sample().fire, false);
  input.dispose();
});
