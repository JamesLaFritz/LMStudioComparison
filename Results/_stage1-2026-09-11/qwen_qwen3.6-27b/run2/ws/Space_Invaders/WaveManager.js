export class WaveManager {
  constructor() {
    this._wave = 1;
    this._totalKilled = 0;
  }

  getWave() {
    return this._wave;
  }

  getMultiplier() {
    return this._wave;
  }

  getTotalKilled() {
    return this._totalKilled;
  }

  advanceWave() {
    this._wave++;
  }

  onInvaderKilled() {
    this._totalKilled++;
  }

  reset() {
    this._wave = 1;
    this._totalKilled = 0;
  }
}
