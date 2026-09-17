import { clamp } from "./math.js";
import { ResourceScope } from "./ResourceScope.js";
const EMPTY = [];
const CODES = new Set([
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "Enter",
  "Escape",
  "KeyP",
]);
const down = (pad, i) =>
  !!pad?.buttons?.[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5);
const axis = (v) =>
  Number.isFinite(v) && Math.abs(v) > 0.18
    ? Math.sign(v) * clamp((Math.abs(v) - 0.18) / 0.82, 0, 1)
    : 0;
export class InputController {
  constructor({
    eventTarget = globalThis.window,
    readGamepads = () => globalThis.navigator?.getGamepads?.() ?? EMPTY,
  } = {}) {
    this.scope = new ResourceScope();
    this.keys = new Set();
    this.readGamepads = readGamepads;
    this.virtual = { left: new Set(), right: new Set(), fire: new Set() };
    this.frame = {
      moveX: 0,
      fire: false,
      confirmPressed: false,
      pausePressed: false,
      backPressed: false,
      navX: 0,
      navY: 0,
      lastDevice: "keyboard",
      disconnected: false,
    };
    this.previous = { confirm: false, pause: false, back: false };
    this.pending = { confirm: false, pause: false, back: false };
    this.gated = false;
    this.padIndex = -1;
    const key = (event, held) => {
      if (!CODES.has(event.code)) return;
      if (
        held &&
        /^(INPUT|SELECT|TEXTAREA)$/.test(event.target?.tagName) &&
        event.code !== "Escape"
      )
        return;
      // A pause/blur clears held keys. Auto-repeat cannot re-arm them until
      // their next physical press, including a held Escape or fire button.
      if (held && event.repeat && !this.keys.has(event.code)) {
        event.preventDefault?.();
        return;
      }
      if (held) {
        if (!this.keys.has(event.code)) {
          if (event.code === "Enter" || event.code === "Space")
            this.pending.confirm = true;
          if (event.code === "Escape" || event.code === "KeyP")
            this.pending.pause = true;
          if (event.code === "Escape") this.pending.back = true;
        }
        this.keys.add(event.code);
        this.frame.lastDevice = "keyboard";
      } else this.keys.delete(event.code);
      event.preventDefault?.();
    };
    const keyDown = (e) => key(e, true),
      keyUp = (e) => key(e, false),
      blur = () => this.clear();
    for (const [name, fn] of [
      ["keydown", keyDown],
      ["keyup", keyUp],
      ["blur", blur],
    ]) {
      eventTarget?.addEventListener(name, fn);
      this.scope.defer(() => eventTarget?.removeEventListener(name, fn));
    }
  }
  setVirtual(action, held, pointerId = 0) {
    const set = this.virtual[action];
    if (!set) return;
    if (held) set.add(pointerId);
    else set.delete(pointerId);
    this.frame.lastDevice = "touch";
  }
  sample() {
    const k = this.keys,
      f = this.frame;
    const left =
      k.has("KeyA") || k.has("ArrowLeft") || this.virtual.left.size > 0;
    const right =
      k.has("KeyD") || k.has("ArrowRight") || this.virtual.right.size > 0;
    let x = Number(right) - Number(left);
    let fire =
      k.has("Space") ||
      k.has("KeyW") ||
      k.has("ArrowUp") ||
      this.virtual.fire.size > 0;
    let confirm = k.has("Enter") || k.has("Space"),
      pause = k.has("Escape") || k.has("KeyP"),
      back = k.has("Escape");
    let navY =
      Number(k.has("KeyS") || k.has("ArrowDown")) -
      Number(k.has("KeyW") || k.has("ArrowUp"));
    let navX = x,
      pads = EMPTY;
    try {
      pads = this.readGamepads() ?? EMPTY;
    } catch {
      pads = EMPTY;
    }
    f.disconnected =
      this.padIndex >= 0 &&
      !pads[this.padIndex]?.connected &&
      f.lastDevice === "gamepad";
    if (f.disconnected) this.padIndex = -1;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p?.connected || p.mapping !== "standard") continue;
      const px =
        down(p, 14) || down(p, 15)
          ? Number(down(p, 15)) - Number(down(p, 14))
          : axis(p.axes?.[0]);
      const py =
        down(p, 12) || down(p, 13)
          ? Number(down(p, 13)) - Number(down(p, 12))
          : axis(p.axes?.[1]);
      const pf = down(p, 0) || down(p, 7),
        pp = down(p, 9),
        pb = down(p, 1);
      if (px || py || pf || pp || pb) {
        this.padIndex = i;
        f.lastDevice = "gamepad";
      }
      if (Math.abs(px) > Math.abs(x)) x = px;
      if (Math.abs(px) > Math.abs(navX)) navX = px;
      if (Math.abs(py) > Math.abs(navY)) navY = py;
      fire ||= pf;
      confirm ||= down(p, 0);
      pause ||= pp;
      back ||= pb;
    }
    if (this.gated && !fire && !confirm) this.gated = false;
    f.moveX = x;
    f.fire = fire && !this.gated;
    f.confirmPressed =
      ((confirm && !this.previous.confirm) || this.pending.confirm) &&
      !this.gated;
    f.pausePressed = (pause && !this.previous.pause) || this.pending.pause;
    f.backPressed = (back && !this.previous.back) || this.pending.back;
    f.navX = navX;
    f.navY = navY;
    this.previous.confirm = confirm;
    this.previous.pause = pause;
    this.previous.back = back;
    this.pending.confirm = this.pending.pause = this.pending.back = false;
    return f;
  }
  requireRelease() {
    this.gated = true;
  }
  clear() {
    this.keys.clear();
    for (const key of Object.keys(this.virtual)) this.virtual[key].clear();
    this.frame.moveX = 0;
    this.frame.fire = false;
    this.gated = true;
    // Preserve sampled controller edges: a held Start must not resume on the
    // very next frame after pause clears the keyboard and virtual controls.
    this.pending.confirm = this.pending.pause = this.pending.back = false;
  }
  dispose() {
    this.clear();
    this.scope.dispose();
  }
}
