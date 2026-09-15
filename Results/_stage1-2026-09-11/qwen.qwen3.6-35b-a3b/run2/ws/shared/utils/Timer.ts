export class Timer {
  private elapsed: number = 0;
  private running: boolean = false;
  private startTime: number = 0;

  get time(): number { return this.elapsed; }
  get isRunning(): boolean { return this.running; }

  start(): void {
    if (!this.running) {
      this.startTime = performance.now();
      this.running = true;
    }
  }

  stop(): void {
    if (this.running) {
      this.elapsed += performance.now() - this.startTime;
      this.running = false;
    }
  }

  reset(): void {
    this.elapsed = 0;
    this.running = false;
  }
}

export class CooldownTracker {
  private cooldowns: Map<string, number> = new Map();

  addCooldown(name: string, duration: number): void {
    this.cooldowns.set(name, performance.now() + duration * 1000);
  }

  canAct(name: string): boolean {
    const end = this.cooldowns.get(name);
    if (end === undefined) return true;
    if (performance.now() >= end) {
      this.cooldowns.delete(name);
      return true;
    }
    return false;
  }

  resetCooldown(name: string): void {
    this.cooldowns.delete(name);
  }
}
