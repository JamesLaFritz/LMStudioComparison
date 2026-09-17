// Raw keyboard state by `KeyboardEvent.code`. Prevents the page from scrolling on game keys.

const PREVENT_DEFAULT = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
]);

export class KeyboardSource {
  constructor(target = window) {
    this.target = target;
    this.down = new Set();
    this.tapped = new Set(); // keys pressed since the last poll, even if already released
    this.pressCounts = new Map(); // monotonic keydown counter per code, for exact edge detection
    this.lastActivity = 0;

    this._onKeyDown = (e) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.tapped.add(e.code);
      this.pressCounts.set(e.code, (this.pressCounts.get(e.code) || 0) + 1);
      this.lastActivity = performance.now();
    };
    this._onKeyUp = (e) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      this.down.delete(e.code);
    };
    this._onBlur = () => {
      this.down.clear();
    };

    target.addEventListener('keydown', this._onKeyDown, { passive: false });
    target.addEventListener('keyup', this._onKeyUp, { passive: false });
    window.addEventListener('blur', this._onBlur);
  }

  isDown(code) {
    return this.down.has(code) || this.tapped.has(code);
  }

  anyDown(codes) {
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (this.down.has(c) || this.tapped.has(c)) return true;
    }
    return false;
  }

  /** Total keydown events ever seen for any of `codes` (monotonic). */
  pressCount(codes) {
    let n = 0;
    for (let i = 0; i < codes.length; i++) n += this.pressCounts.get(codes[i]) || 0;
    return n;
  }

  /** Call once per frame after edges have been computed. */
  endFrame() {
    this.tapped.clear();
  }

  dispose() {
    this.target.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.down.clear();
    this.tapped.clear();
  }
}
