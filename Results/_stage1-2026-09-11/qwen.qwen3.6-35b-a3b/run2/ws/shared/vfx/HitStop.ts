export class HitStop {
  private framesRemaining: number = 0;
  private totalFrames: number = 0;

  constructor() {}

  trigger(frames: number = 4): void {
    this.framesRemaining += frames;
    this.totalFrames = Math.max(this.totalFrames, frames);
  }

  get timescale(): number {
    return this.framesRemaining > 0 ? 0.1 : 1.0;
  }

  update(dt: number): void {
    if (this.framesRemaining > 0) {
      // dt is in seconds, assume ~60fps so each frame ≈ 0.0167s
      this.framesRemaining -= dt / 0.0167;
      if (this.framesRemaining < 0) this.framesRemaining = 0;
    }
  }

  get isActive(): boolean {
    return this.framesRemaining > 0;
  }

  reset(): void {
    this.framesRemaining = 0;
  }
}
