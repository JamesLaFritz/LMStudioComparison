export class FixedStepClock {
  constructor(step = 1 / 120, maxSubSteps = 6) {
    this.step = step;
    this.maxSubSteps = maxSubSteps;
    this.accumulator = 0;
  }

  consume(delta, update) {
    this.accumulator = Math.min(this.accumulator + delta, this.step * this.maxSubSteps);
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxSubSteps) {
      update(this.step);
      this.accumulator -= this.step;
      steps += 1;
    }
    if (steps === this.maxSubSteps && this.accumulator >= this.step) {
      this.accumulator = 0;
    }
    return this.accumulator / this.step;
  }

  reset() {
    this.accumulator = 0;
  }
}
