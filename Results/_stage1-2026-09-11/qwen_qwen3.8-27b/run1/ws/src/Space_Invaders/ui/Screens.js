import { GlassUI } from '@shared/core/GlassUI.js';

/**
 * Screens — start / pause / game-over / wave-clear overlays.
 *
 * Built on GlassUI. Each screen is a full-screen overlay with a centered
 * glass card. Buttons are wired to the callbacks passed by the orchestrator
 * (onStart / onResume / onRestart). The start screen is shown on boot; the
 * others appear on state transitions.
 */
export class Screens {
  /**
   * @param {HTMLElement} container
   * @param {object} [cb]
   * @param {Function} [cb.onStart]   — start / restart a run
   * @param {Function} [cb.onResume]  — resume from pause
   * @param {Function} [cb.onRestart] — restart from game over
   */
  constructor(container, cb = {}) {
    this.container = container;
    this.cb = cb;
    this.root = GlassUI.root(container);
    this.active = null; // currently visible screen root
  }

  /** Show a named screen. `data` is optional per-screen payload. */
  show(name, data = {}) {
    this.hideAll();
    let root;
    switch (name) {
      case 'start':
        root = this._start();
        break;
      case 'pause':
        root = this._pause();
        break;
      case 'gameOver':
        root = this._gameOver(data);
        break;
      case 'waveClear':
        root = this._waveClear(data);
        break;
      default:
        return;
    }
    this.active = root;
  }

  hideAll() {
    if (this.active) {
      GlassUI.hide(this.active);
      this.active = null;
    }
  }

  // ── Individual screens ─────────────────────────────────────────────────────

  _start() {
    const { root } = GlassUI.screen(this.root, {
      title: 'NEON INVADERS',
      sub: 'Sector 7 Defense',
      buttons: [
        { label: 'Start', onClick: () => this.cb.onStart && this.cb.onStart() },
      ],
    });
    // Key hints under the button.
    const hints = document.createElement('div');
    hints.className = 'key-hint';
    hints.innerHTML =
      '<b>A / D</b> or <b>◄ ►</b> move &nbsp;·&nbsp; <b>Space</b> fire &nbsp;·&nbsp; <b>P</b> pause';
    root.querySelector('.screen-card').appendChild(hints);
    return root;
  }

  _pause() {
    const { root } = GlassUI.screen(this.root, {
      title: 'PAUSED',
      sub: 'Take a breath, pilot',
      buttons: [
        { label: 'Resume', onClick: () => this.cb.onResume && this.cb.onResume() },
      ],
    });
    const hints = document.createElement('div');
    hints.className = 'key-hint';
    hints.innerHTML = 'Press <b>P</b> or <b>Esc</b> to resume';
    root.querySelector('.screen-card').appendChild(hints);
    return root;
  }

  _gameOver(data) {
    const { root } = GlassUI.screen(this.root, {
      title: 'GAME OVER',
      sub: 'The sector has fallen',
      stats: [
        { label: 'Score', value: data.score ?? 0 },
        { label: 'Hi-Score', value: data.hiScore ?? 0, cls: 'magenta' },
        { label: 'Wave', value: data.wave ?? 1, cls: 'green' },
      ],
      buttons: [
        { label: 'Play Again', cls: 'magenta', onClick: () => this.cb.onRestart && this.cb.onRestart() },
      ],
    });
    const hints = document.createElement('div');
    hints.className = 'key-hint';
    hints.innerHTML = 'Press <b>Enter</b> to restart';
    root.querySelector('.screen-card').appendChild(hints);
    return root;
  }

  _waveClear(data) {
    const { root } = GlassUI.screen(this.root, {
      title: 'WAVE CLEARED',
      sub: `Wave ${data.wave ?? 1} complete`,
      stats: [
        { label: 'Score', value: data.score ?? 0 },
      ],
    });
    const next = document.createElement('div');
    next.className = 'key-hint';
    next.textContent = 'Next wave incoming…';
    root.querySelector('.screen-card').appendChild(next);
    return root;
  }

  dispose() {
    this.hideAll();
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
  }
}
