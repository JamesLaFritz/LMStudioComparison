import { clamp } from '../../shared/math/MathUtils.js';
import CONFIG from '../config.js';

const BEST_KEY = 'si_best_score';

/**
 * Score + combo multiplier + best-score persistence (localStorage).
 * The game owns the running score; this system owns the combo chain and the
 * persisted record. `add(base, mult)` returns the final awarded amount so the
 * caller can display it as floating text.
 */
export class ScoringSystem {
  constructor() {
    this.combo = 1;
    this.comboTimer = 0;
  }

  static loadBest() {
    try { return Number(localStorage.getItem(BEST_KEY) || 0) | 0; } catch (_) { return 0; }
  }

  static saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (_) { /* private mode */ }
  }

  reset() {
    this.combo = 1;
    this.comboTimer = 0;
  }

  /** Award base points × current combo. Returns the awarded amount. */
  add(base, mult) {
    const m = clamp(Math.round(mult || 1), 1, CONFIG.scoring.comboMaxMult);
    return Math.round(base * m);
  }

  /** Register a kill: extend the chain window and raise the multiplier one tier. */
  bumpCombo() {
    this.comboTimer = CONFIG.scoring.comboWindow;
    if (this.combo < CONFIG.scoring.comboMaxMult) this.combo += 1;
    return this.combo;
  }

  /** Combo decay: drop one tier per window, not an instant reset. */
  update(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0 && this.combo > 1) {
        this.combo = Math.max(1, this.combo - 1);
        this.comboTimer = CONFIG.scoring.comboWindow * 0.6;
      }
    }
  }

  get currentCombo() { return this.combo; }
}
