import { GlassUI } from '@shared/core/GlassUI.js';
import { CONFIG } from '../config.js';

const POWER_ORDER = ['DOUBLE', 'RAPID', 'SHIELD', 'WIDE'];

/**
 * HUD — the persistent in-game readout (score, hi-score, wave, combo, lives,
 * active power-ups) plus the red damage-flash overlay.
 *
 * Built entirely from the shared GlassUI design system so it stays consistent
 * with the screens. `set()` is called by the orchestrator whenever a value
 * changes; it only touches the DOM when the values actually differ.
 */
export class HUD {
  constructor(container) {
    this.root = GlassUI.root(container);

    this.bar = document.createElement('div');
    this.bar.className = 'glass-hud';
    this.root.appendChild(this.bar);

    // Left: score + hi-score.
    const left = GlassUI.panel('hud-block');
    this.scoreEl = this._stat(left, 'SCORE', '000000');
    this.hiEl = this._stat(left, 'HI-SCORE', '000000');
    this.bar.appendChild(left);

    // Center: wave + combo meter.
    const center = document.createElement('div');
    center.className = 'hud-center';
    const wavePanel = GlassUI.panel('hud-block');
    wavePanel.style.minWidth = '84px';
    this.waveEl = this._stat(wavePanel, 'WAVE', '1');
    center.appendChild(wavePanel);

    const comboWrap = document.createElement('div');
    const comboLabel = document.createElement('div');
    comboLabel.className = 'hud-label';
    comboLabel.textContent = 'COMBO';
    this.comboEl = document.createElement('div');
    this.comboEl.className = 'hud-value';
    this.comboEl.textContent = '×1';
    const meter = document.createElement('div');
    meter.className = 'combo-meter';
    this.comboFill = document.createElement('div');
    this.comboFill.className = 'combo-fill';
    meter.appendChild(this.comboFill);
    comboWrap.append(comboLabel, this.comboEl, meter);
    center.appendChild(comboWrap);
    this.bar.appendChild(center);

    // Right: lives + active power-ups.
    const right = GlassUI.panel('hud-block');
    this.livesEl = this._stat(right, 'LIVES', '3');
    this.powerWrap = document.createElement('div');
    this.powerWrap.className = 'power-tags';
    right.appendChild(this.powerWrap);
    this.bar.appendChild(right);

    // Red damage-flash overlay (driven by the orchestrator each frame).
    this.flash = GlassUI.flashOverlay(this.root);
  }

  _stat(parent, label, value) {
    const l = document.createElement('div');
    l.className = 'hud-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = 'hud-value';
    v.textContent = value;
    parent.append(l, v);
    return v;
  }

  /**
   * Update the readout.
   * @param {object} s
   * @param {number} s.score
   * @param {number} s.hiScore
   * @param {number} s.lives
   * @param {number} s.wave
   * @param {number} s.combo — current multiplier (1..CONFIG.COMBO.max)
   * @param {object} s.powerTimers — { DOUBLE, RAPID, SHIELD, WIDE } seconds left
   */
  set({ score, hiScore, lives, wave, combo, powerTimers }) {
    this.scoreEl.textContent = String(score).padStart(6, '0');
    this.hiEl.textContent = String(hiScore).padStart(6, '0');
    this.livesEl.textContent = String(lives);
    this.waveEl.textContent = String(wave);
    this.comboEl.textContent = `×${combo}`;

    const span = CONFIG.COMBO.max - 1;
    const pct = span > 0 ? Math.max(0, Math.min(1, (combo - 1) / span)) : 0;
    this.comboFill.style.width = `${(pct * 100).toFixed(1)}%`;

    // Active power-up tags (rebuild only when the set of active types changes).
    const active = POWER_ORDER.filter((k) => powerTimers && powerTimers[k] > 0);
    const key = active.join('|');
    if (key !== this._lastPowerKey) {
      this._lastPowerKey = key;
      this.powerWrap.textContent = '';
      for (const k of active) {
        const tag = document.createElement('div');
        tag.className = 'power-tag';
        tag.textContent = k;
        this.powerWrap.appendChild(tag);
      }
    }
  }

  dispose() {
    this.root.remove();
  }
}
