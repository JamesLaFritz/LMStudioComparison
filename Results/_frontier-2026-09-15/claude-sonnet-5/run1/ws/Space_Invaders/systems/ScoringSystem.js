import { COMBO } from '../config/GameConfig.js';

/**
 * Score + combo tracking. Combo resets if the player goes COMBO.comboWindowSeconds
 * without a kill; each consecutive kill within the window raises the multiplier.
 */
export class ScoringSystem {
  constructor(floatingText) {
    this._floatingText = floatingText;
    this.score = 0;
    this.combo = 0;
    this._comboTimer = 0;
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this._comboTimer = 0;
  }

  update(dt) {
    if (this._comboTimer <= 0) return;
    this._comboTimer -= dt;
    if (this._comboTimer <= 0) this.combo = 0;
  }

  awardKill(basePoints, worldX, worldY, worldZ) {
    this.combo += 1;
    this._comboTimer = COMBO.comboWindowSeconds;

    const multiplier = 1 + COMBO.scorePerKillMultiplierStep * (this.combo - 1);
    const awarded = Math.round(basePoints * multiplier);
    this.score += awarded;

    this._floatingText.spawn({
      x: worldX,
      y: worldY + 0.6,
      z: worldZ,
      text: `+${awarded}`,
      color: this.combo > 1 ? '#ffb02e' : '#4de8ff',
      fontSize: this.combo > 1 ? 20 : 16,
      duration: 0.8,
      riseSpeed: 1.4
    });

    return awarded;
  }

  awardBonus(points, worldX, worldY, worldZ, label = 'BONUS') {
    this.score += points;
    this._floatingText.spawn({
      x: worldX,
      y: worldY + 0.8,
      z: worldZ,
      text: `${label} +${points}`,
      color: '#ffd700',
      fontSize: 24,
      duration: 1.1,
      riseSpeed: 1.6
    });
    return points;
  }

  breakCombo() {
    this.combo = 0;
    this._comboTimer = 0;
  }
}
