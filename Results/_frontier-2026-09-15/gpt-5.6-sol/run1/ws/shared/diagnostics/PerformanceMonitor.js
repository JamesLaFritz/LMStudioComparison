import { clamp } from '../math/MathUtils.js';

export class PerformanceMonitor {
  constructor() {
    this.samples = new Float32Array(180);
    this.cursor = 0;
    this.count = 0;
    this.sum = 0;
    this.slowSeconds = 0;
    this.fastSeconds = 0;
    this.droppedSimulationTime = 0;
    this.spawnFailures = 0;
  }

  update(frameDt) {
    const ms = clamp(frameDt * 1000, 0, 250);
    if (this.count < this.samples.length) this.count += 1;
    else this.sum -= this.samples[this.cursor];
    this.samples[this.cursor] = ms;
    this.sum += ms;
    this.cursor = (this.cursor + 1) % this.samples.length;
    const average = this.averageMs;
    this.slowSeconds = average > 23 ? this.slowSeconds + frameDt : 0;
    this.fastSeconds = average < 17.5 ? this.fastSeconds + frameDt : 0;
  }

  addDroppedTime(seconds) {
    this.droppedSimulationTime += seconds;
  }

  get averageMs() {
    return this.count === 0 ? 0 : this.sum / this.count;
  }

  qualityRecommendation(currentCap) {
    if (this.slowSeconds > 3 && currentCap > 1.25) {
      this.slowSeconds = 0;
      return 1.25;
    }
    if (this.fastSeconds > 12 && currentCap < 1.75) {
      this.fastSeconds = 0;
      return 1.75;
    }
    return currentCap;
  }

  snapshot() {
    return {
      averageMs: Number(this.averageMs.toFixed(2)),
      droppedSimulationTime: Number(this.droppedSimulationTime.toFixed(3)),
      spawnFailures: this.spawnFailures,
    };
  }
}
