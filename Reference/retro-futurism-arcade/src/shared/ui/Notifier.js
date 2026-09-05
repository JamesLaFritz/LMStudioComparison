/**
 * Transient banner queue.
 *
 * Shows short, high-signal messages near the top of the playfield: wave
 * announcements, combo milestones, extra lives. Distinct from `FloatingText`,
 * which is world-anchored and tied to a specific position — a notifier banner
 * is screen-anchored and about the run as a whole.
 *
 * ### Why a queue rather than a stack
 *
 * Several notable things can happen in one tick — clearing a wave can award an
 * extra life and break a combo record simultaneously. Showing all of them at
 * once produces an unreadable pile, and showing only the last one silently
 * discards information the player earned. The queue displays them in sequence
 * with a short stagger, so each is legible and none are lost.
 *
 * The queue is bounded. If more messages arrive than can reasonably be read,
 * the *oldest pending* ones are dropped rather than the newest, because in a
 * game the most recent event is almost always the most relevant.
 */
export class Notifier {
  /**
   * @param {HTMLElement} root
   * @param {object} [opts]
   * @param {number} [opts.maxVisible] concurrent banners
   * @param {number} [opts.maxQueued]  pending backlog before dropping
   */
  constructor(root, { maxVisible = 2, maxQueued = 4 } = {}) {
    this.maxVisible = maxVisible;
    this.maxQueued = maxQueued;

    this.layer = document.createElement('div');
    this.layer.className = 'notify-layer';
    this.layer.setAttribute('aria-live', 'polite');
    this.layer.setAttribute('aria-atomic', 'false');
    root.appendChild(this.layer);

    /** @type {Array<{text:string, variant:string, duration:number}>} */
    this.queue = [];
    /** @type {Array<{el:HTMLElement, remaining:number, state:string}>} */
    this.active = [];

    /** Stagger between consecutive banners appearing. */
    this.staggerDelay = 0.12;
    this._staggerTimer = 0;
  }

  /**
   * Enqueue a banner.
   *
   * @param {string} text
   * @param {object} [opts]
   * @param {string} [opts.variant] 'neon' | 'neon neon--magenta' | ...
   * @param {number} [opts.duration] seconds fully visible
   * @param {boolean} [opts.immediate] clear the queue and show this now
   */
  show(text, { variant = 'neon', duration = 1.6, immediate = false } = {}) {
    if (immediate) {
      this.queue.length = 0;
      for (const entry of this.active) {
        // Start their exit immediately rather than removing them outright, so
        // the replacement does not appear to teleport in over a hard cut.
        entry.remaining = Math.min(entry.remaining, 0.05);
      }
    }

    this.queue.push({ text, variant, duration });

    // Bounded backlog — drop the oldest pending, keep the newest.
    while (this.queue.length > this.maxQueued) {
      this.queue.shift();
    }
  }

  /**
   * Advance timers and promote queued banners.
   * @param {number} unscaledDt UI must not freeze during hit-stop
   */
  update(unscaledDt) {
    // --- Retire expired banners ------------------------------------------
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i];
      entry.remaining -= unscaledDt;

      if (entry.remaining <= 0 && entry.state === 'visible') {
        entry.state = 'leaving';
        entry.el.classList.remove('notify--visible');
        // Match the CSS transition duration before removing the node.
        entry.remaining = 0.28;
      } else if (entry.remaining <= 0 && entry.state === 'leaving') {
        if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
        this.active.splice(i, 1);
      }
    }

    // --- Promote from the queue -------------------------------------------
    if (this._staggerTimer > 0) {
      this._staggerTimer -= unscaledDt;
      return;
    }

    const visibleCount = this.active.filter((e) => e.state === 'visible').length;
    if (this.queue.length === 0 || visibleCount >= this.maxVisible) return;

    const spec = this.queue.shift();
    this._present(spec);
    this._staggerTimer = this.staggerDelay;
  }

  _present({ text, variant, duration }) {
    const el = document.createElement('div');
    el.className = `notify ${variant}`;
    el.textContent = text;
    this.layer.appendChild(el);

    // Force a style flush before adding the visible class, otherwise the
    // browser batches insertion and class change into one style pass, sees no
    // change in the transitioned properties, and skips the animation entirely.
    void el.offsetWidth;
    el.classList.add('notify--visible');

    this.active.push({ el, remaining: duration, state: 'visible' });
  }

  /** Remove everything immediately, queued and visible. */
  clear() {
    this.queue.length = 0;
    for (const entry of this.active) {
      if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
    }
    this.active.length = 0;
    this._staggerTimer = 0;
  }

  dispose() {
    this.clear();
    if (this.layer.parentNode) this.layer.parentNode.removeChild(this.layer);
  }
}
