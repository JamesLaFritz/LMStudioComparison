/**
 * Generic typed object pool to avoid GC pressure.
 * T must be a plain object with reset(): void method.
 */
export class Pool<T extends { reset(): void }> {
  private free: T[] = [];
  private active: T[] = [];

  constructor(private factory: () => T, private initialSize: number = 0) {
    for (let i = 0; i < initialSize; i++) {
      const obj = this.factory();
      this.free.push(obj);
    }
  }

  /** Acquire an object from the pool. Creates a new one if none available. */
  acquire(): T {
    let obj: T;
    if (this.free.length > 0) {
      obj = this.free.pop()!;
    } else {
      obj = this.factory();
    }
    obj.reset();
    this.active.push(obj);
    return obj;
  }

  /** Return an object to the pool. */
  release(obj: T): void {
    const idx = this.active.indexOf(obj);
    if (idx === -1) return; // already released or never acquired
    this.active.splice(idx, 1);
    this.free.push(obj);
  }

  /** Release all active objects back to the pool. */
  releaseAll(): void {
    for (let i = 0; i < this.active.length; i++) {
      this.free.push(this.active[i]);
    }
    this.active.length = 0;
  }

  get size(): number {
    return this.active.length + this.free.length;
  }

  get activeCount(): number {
    return this.active.length;
  }

  get freeCount(): number {
    return this.free.length;
  }
}
