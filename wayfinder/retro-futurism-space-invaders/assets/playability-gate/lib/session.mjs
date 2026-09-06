/**
 * The session: a real browser, real key events, and the two ways the gate is
 * allowed to observe.
 *
 * ### The rule this file exists to enforce
 *
 * The gate may *read* game state to confirm what it caused. It may never
 * *cause* state to change by calling into game internals. Every state change in
 * a gate run originates from `page.keyboard.*` or `page.mouse.*`, which
 * Playwright dispatches through CDP `Input.dispatchKeyEvent` /
 * `Input.dispatchMouseEvent` — the browser's real input pipeline, upstream of
 * the page's own listeners. There is no code path in this harness that calls a
 * game method, sets a game field, or synthesises a `KeyboardEvent` in page
 * script.
 *
 * That is not pedantry. The build this gate was written against passed every
 * automated check it had because those checks never pressed a key.
 */

import fs from 'node:fs';
import path from 'node:path';
import { decodePng } from './png.mjs';

/** Read-only probe contract version this harness understands. See gate.md. */
export const PROBE_VERSION = 1;

export class Session {
  /**
   * @param {import('playwright').Page} page
   * @param {object} target resolved target config
   * @param {string} outDir evidence directory
   */
  constructor(page, target, outDir) {
    this.page = page;
    this.target = target;
    this.outDir = outDir;
    this.shotDir = path.join(outDir, 'frames');
    fs.mkdirSync(this.shotDir, { recursive: true });

    /** @type {{type:string, text:string, t:number}[]} */
    this.console = [];
    /** @type {string[]} */
    this.pageErrors = [];
    /** @type {string[]} */
    this.failedRequests = [];
    /** @type {string[]} */
    this.heldKeys = [];
    /** @type {{t:number, action:string, detail:string}[]} */
    this.inputLog = [];

    this.t0 = Date.now();
    this._shotIndex = 0;

    page.on('console', (msg) => {
      this.console.push({ type: msg.type(), text: msg.text(), t: this.now() });
    });
    page.on('pageerror', (err) => {
      this.pageErrors.push(String(err && err.stack ? err.stack : err));
    });
    page.on('requestfailed', (req) => {
      const f = req.failure();
      this.failedRequests.push(`${req.url()} — ${f ? f.errorText : 'unknown'}`);
    });
  }

  now() {
    return (Date.now() - this.t0) / 1000;
  }

  /* ---------------------------------------------------------------- *
   * Real input
   * ---------------------------------------------------------------- */

  async keyDown(code) {
    this.inputLog.push({ t: this.now(), action: 'keydown', detail: code });
    if (!this.heldKeys.includes(code)) this.heldKeys.push(code);
    await this.page.keyboard.down(code);
  }

  async keyUp(code) {
    this.inputLog.push({ t: this.now(), action: 'keyup', detail: code });
    this.heldKeys = this.heldKeys.filter((k) => k !== code);
    await this.page.keyboard.up(code);
  }

  /** Hold a key for a wall-clock duration, then release it. */
  async hold(code, ms) {
    await this.keyDown(code);
    await this.sleep(ms);
    await this.keyUp(code);
  }

  async tap(code, downMs = 40) {
    await this.hold(code, downMs);
  }

  async click(selector) {
    this.inputLog.push({ t: this.now(), action: 'click', detail: selector });
    await this.page.click(selector, { timeout: 5000 });
  }

  /** Release everything the harness is holding. Called at teardown, and proved. */
  async releaseAll() {
    for (const code of [...this.heldKeys]) {
      await this.keyUp(code).catch(() => {});
    }
  }

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* ---------------------------------------------------------------- *
   * Observation — pixels
   * ---------------------------------------------------------------- */

  /**
   * Capture the viewport and decode it.
   * @param {string} label goes in the filename so evidence is self-describing
   * @param {boolean} [keep=true] write the PNG to the evidence directory
   */
  async shot(label, keep = true) {
    const buf = await this.page.screenshot({ type: 'png', animations: 'allow' });
    const img = decodePng(buf);
    img.label = label;
    img.t = this.now();
    if (keep) {
      const name = `${String(this._shotIndex++).padStart(4, '0')}-${label}.png`;
      fs.writeFileSync(path.join(this.shotDir, name), buf);
      img.file = path.join('frames', name);
    }
    return img;
  }

  /**
   * Capture a rapid sequence of whole frames while an action runs, sampling the
   * state probe alongside.
   *
   * A burst is the workhorse of the VFX checks: one player action produces one
   * burst, and every mandated effect is then located *within* that burst by its
   * own signature, at its own timestamp. Effects that all fire on the same
   * event stay individually observable because they are separated in time and
   * in space, not because someone eyeballed an explosion and called it six
   * things.
   *
   * Frames come from CDP `Page.startScreencast`, which pushes compositor frames
   * at display rate. Sequential `page.screenshot()` calls cannot do this job —
   * they are round-trips, and at one frame per second every short-lived effect
   * on the mandated list is invisible. If the screencast cannot be opened the
   * method degrades to screenshots and *says so* in the returned metadata, so a
   * verdict is never silently based on evidence too coarse to carry it.
   *
   * @param {string} label
   * @param {object} opts
   * @param {number} opts.durationMs how long to capture
   * @param {() => Promise<void>} [opts.during] action to run while capturing
   * @param {boolean} [opts.keep=false] persist every frame (large)
   * @returns {Promise<Array<{img:object, state:object|null, t:number, index:number}>>}
   */
  async burst(label, { durationMs = 2000, during, keep = false, keepEvery = 0, fps = 0, scale = 1 } = {}) {
    const raw = [];
    const states = [];
    let cdp = null;

    try {
      cdp = await this.page.context().newCDPSession(this.page);
      cdp.on('Page.screencastFrame', (e) => {
        raw.push({ data: e.data, t: this.now() });
        cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
      });
      // Page.enable first. Without the Page domain enabled, startScreencast is
      // accepted and then silently pushes nothing — the capture reports zero
      // frames, degrades to the screenshot path, and every verb that needs to
      // difference frames goes red against working code. That is how the six
      // mandated VFX and every centroid check failed on a build whose own probe
      // showed the ship moving and the projectile firing.
      await cdp.send('Page.enable');
      await cdp.send('Page.startScreencast', {
        format: 'png',
        everyNthFrame: fps ? Math.max(1, Math.round(60 / fps)) : 1,
        maxWidth: Math.round(this.target.viewport.width * scale),
        maxHeight: Math.round(this.target.viewport.height * scale)
      });
      // Give the compositor a beat to deliver the first frame, so a short burst
      // does not race the stream opening and conclude the stream is dead.
      await this.sleep(120);
    } catch {
      cdp = null;
    }

    // Poll the probe on its own cadence and align by timestamp afterwards.
    let polling = true;
    const poller = (async () => {
      while (polling) {
        states.push({ t: this.now(), state: await this.readState() });
        await this.sleep(60);
      }
    })();

    const action = during ? during() : this.sleep(durationMs);
    const timer = this.sleep(durationMs);
    await Promise.all([action, timer]);

    polling = false;
    await poller;
    if (cdp) {
      await cdp.send('Page.stopScreencast').catch(() => {});
      await cdp.detach().catch(() => {});
    }

    const nearestState = (t) => {
      let best = null;
      let bestD = Infinity;
      for (const s of states) {
        const d = Math.abs(s.t - t);
        if (d < bestD) {
          bestD = d;
          best = s.state;
        }
      }
      return best;
    };

    const frames = [];
    if (cdp && raw.length) {
      raw.forEach((r, i) => {
        let img;
        try {
          img = decodePng(Buffer.from(r.data, 'base64'));
        } catch {
          return;
        }
        img.label = `${label}-${i}`;
        img.t = r.t;
        if (keep || (keepEvery > 0 && i % keepEvery === 0)) {
          const name = `${String(this._shotIndex++).padStart(4, '0')}-${label}-${String(i).padStart(3, '0')}.png`;
          fs.writeFileSync(path.join(this.shotDir, name), Buffer.from(r.data, 'base64'));
          img.file = path.join('frames', name);
        }
        frames.push({ img, state: nearestState(r.t), t: r.t, index: frames.length });
      });
      frames.source = 'screencast';
    }

    if (!frames.length) {
      // Fallback: whatever the screenshot path can manage in the time given.
      const deadline = Date.now() + Math.min(durationMs, 4000);
      while (Date.now() < deadline) {
        const state = await this.readState();
        const img = await this.shot(`${label}-fb-${frames.length}`, keep);
        frames.push({ img, state, t: img.t, index: frames.length });
      }
      frames.source = 'screenshot-fallback';
    }

    // Screencast frames can come back at a different size than the viewport if
    // the compositor scaled them; drop any that do not match the majority size
    // so downstream diffs never compare mismatched buffers.
    const sizes = new Map();
    for (const f of frames) {
      const k = `${f.img.width}x${f.img.height}`;
      sizes.set(k, (sizes.get(k) || 0) + 1);
    }
    const dominant = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const kept = frames.filter((f) => `${f.img.width}x${f.img.height}` === dominant);
    kept.forEach((f, i) => {
      f.index = i;
    });
    kept.source = frames.source;
    kept.cadenceMs = kept.length > 1 ? ((kept[kept.length - 1].t - kept[0].t) * 1000) / (kept.length - 1) : NaN;
    return kept;
  }

  /* ---------------------------------------------------------------- *
   * Observation — state
   * ---------------------------------------------------------------- */

  /** Is the build exposing the read-only gate probe? */
  async hasProbe() {
    if (this._probeChecked !== undefined) return this._probeChecked;
    this._probeChecked = await this.page
      .evaluate(() => {
        const g = globalThis.__gate;
        return !!(g && typeof g.snapshot === 'function');
      })
      .catch(() => false);
    return this._probeChecked;
  }

  /**
   * One state reading.
   *
   * Prefers `window.__gate.snapshot()` — the read-only probe the reference
   * build is required to expose. Falls back to scraping the HUD from the DOM,
   * which is all a foreign build (a contestant's, or the frozen 2026-09-04
   * local build) can be expected to offer. The `source` field records which,
   * because a verb proved only by DOM scraping is weaker evidence and the
   * report must say so.
   *
   * @returns {Promise<object|null>}
   */
  async readState() {
    const sel = this.target.selectors || {};
    return this.page
      .evaluate((selectors) => {
        const num = (s) => {
          if (!s) return null;
          const el = document.querySelector(s);
          if (!el) return null;
          const m = (el.textContent || '').replace(/[^0-9-]/g, '');
          return m === '' ? null : Number(m);
        };
        const count = (s) => (s ? document.querySelectorAll(s).length : null);

        const g = globalThis.__gate;
        if (g && typeof g.snapshot === 'function') {
          try {
            const snap = g.snapshot();
            return { source: 'probe', wall: Date.now(), ...snap };
          } catch (err) {
            return { source: 'probe-error', wall: Date.now(), error: String(err) };
          }
        }

        return {
          source: 'dom',
          wall: Date.now(),
          score: num(selectors.score),
          highScore: num(selectors.highScore),
          wave: num(selectors.wave),
          lives: num(selectors.lives),
          livesCount: count(selectors.lifeIcon),
          hash: location.hash,
          gameOverVisible: selectors.gameOver
            ? (() => {
                const el = document.querySelector(selectors.gameOver);
                if (!el) return false;
                const cs = getComputedStyle(el);
                return (
                  cs.display !== 'none' &&
                  cs.visibility !== 'hidden' &&
                  Number(cs.opacity) > 0.01 &&
                  !el.classList.contains('hidden')
                );
              })()
            : null
        };
      }, sel)
      .catch(() => null);
  }

  /* ---------------------------------------------------------------- *
   * Frame plumbing
   * ---------------------------------------------------------------- */

  /**
   * Wait for `n` animation frames, with a hard timeout.
   *
   * Returns false on timeout rather than throwing: a page whose rAF never fires
   * is a *finding*, not a harness crash, and the difference matters — the skill
   * this gate implements is explicit that a crash must never be counted as a
   * red gate.
   */
  async waitFrames(n = 2, timeoutMs = 3000) {
    return this.page
      .evaluate(
        ([frames, timeout]) =>
          new Promise((resolve) => {
            let seen = 0;
            const timer = setTimeout(() => resolve(false), timeout);
            const step = () => {
              if (++seen >= frames) {
                clearTimeout(timer);
                resolve(true);
                return;
              }
              requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }),
        [n, timeoutMs]
      )
      .catch(() => false);
  }

  /**
   * Count animation frames over a window.
   *
   * A live rAF is a precondition for every pixel observable in the gate: if the
   * page is not painting, "zero differing pixels" means nothing. This check is
   * what turns that from an assumption into a measurement.
   */
  async countFrames(windowMs = 1000) {
    return this.page
      .evaluate(
        (ms) =>
          new Promise((resolve) => {
            let n = 0;
            const start = performance.now();
            const tick = () => {
              n++;
              if (performance.now() - start >= ms) resolve(n);
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            setTimeout(() => resolve(n), ms + 500);
          }),
        windowMs
      )
      .catch(() => 0);
  }

  async visibility() {
    return this.page.evaluate(() => ({
      state: document.visibilityState,
      hidden: document.hidden,
      focused: document.hasFocus()
    }));
  }
}
