export class ScoreSystem {
  constructor() {
    this._score = 0;
    this._combo = 0;
    this._multiplier = 1;
    this._lastKillTime = 0;
    this._totalKills = 0;
    this._totalShots = 0;
  }

  onShoot() {
    this._totalShots++;
  }

  onKill(currentTime) {
    this._totalKills++;
    const elapsed = (currentTime - this._lastKillTime) / 1000;
    if (elapsed < 1.5 && this._combo < 5) {
      this._combo++;
      this._multiplier = this._combo;
    } else if (elapsed >= 1.5) {
      this._combo = 0;
      this._multiplier = 1;
    }
    this._lastKillTime = currentTime;
    return this._multiplier;
  }

  add(points, _multiplier) {
    this._score += points;
  }

  getScore() { return this._score; }
  getCombo() { return this._combo; }
  getMultiplier() { return this._multiplier; }
  getTotalKills() { return this._totalKills; }
  getTotalShots() { return this._totalShots; }
  getAccuracy() {
    if (this._totalShots === 0) return 100;
    return Math.round((this._totalKills / this._totalShots) * 100);
  }

  onWaveClear() {
    // Reset combo between waves
    this._combo = 0;
    this._multiplier = 1;
  }

  reset() {
    this._score = 0;
    this._combo = 0;
    this._multiplier = 1;
    this._lastKillTime = 0;
    this._totalKills = 0;
    this._totalShots = 0;
  }
}
