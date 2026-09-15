/**
 * Generic Object Pool for Three.js entities and game objects.
 * Implements LIFO pooling with automatic expansion when capacity is exceeded.
 */

export interface PooledObject<T> {
  instance: T;
  isActive: boolean;
  lastUsed: number;
}

export class ObjectPool<T> {
  private pool: PooledObject<T>[] = [];
  private maxSize: number;
  private factory: () => T;
  private resetCallback?: (obj: T) => void;
  
  constructor(factory: () => T, maxSize: number, resetCallback?: (obj: T) => void) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.resetCallback = resetCallback;
    
    // Pre-allocate pool to avoid initial allocations
    for (let i = 0; i < maxSize; i++) {
      this.pool.push({
        instance: factory(),
        isActive: false,
        lastUsed: -1
      });
    }
  }

  /**
   * Get an active object from the pool. Creates new if all are inactive.
   */
  acquire(): T | null {
    // Find inactive object with longest idle time (FIFO within inactive)
    let bestIndex = -1;
    let oldestTime = Infinity;

    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].isActive && this.pool[i].lastUsed < oldestTime) {
        oldestTime = this.pool[i].lastUsed;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) {
      // All active, expand pool if possible
      if (this.pool.length < this.maxSize * 2) {
        const newObj = this.factory();
        this.pool.push({
          instance: newObj,
          isActive: true,
          lastUsed: performance.now()
        });
        return newObj;
      }
      // Pool exhausted - return oldest inactive anyway (force reuse)
      let oldestIndex = 0;
      for (let i = 1; i < this.pool.length; i++) {
        if (this.pool[i].lastUsed < this.pool[oldestIndex].lastUsed) {
          oldestIndex = i;
        }
      }
      return this.activate(oldestIndex);
    }

    return this.activate(bestIndex);
  }

  private activate(index: number): T {
    const obj = this.pool[index];
    obj.isActive = true;
    obj.lastUsed = performance.now();
    
    if (this.resetCallback) {
      this.resetCallback(obj.instance);
    }
    
    return obj.instance;
  }

  /**
   * Mark an object as inactive, returning it to the pool.
   */
  release(obj: T): void {
    const poolObj = this.pool.find(p => p.instance === obj);
    if (poolObj) {
      poolObj.isActive = false;
      // Don't update lastUsed here - keep track of when it was last used
    }
  }

  /**
   * Release all objects and reset the pool.
   */
  clear(): void {
    for (const item of this.pool) {
      item.isActive = false;
    }
  }

  /**
   * Get count of active objects.
   */
  get activeCount(): number {
    return this.pool.filter(p => p.isActive).length;
  }

  /**
   * Get total pool size.
   */
  get size(): number {
    return this.pool.length;
  }

  /**
   * Dispose all objects and clear the pool.
   */
  dispose(): void {
    for (const item of this.pool) {
      if (this.resetCallback) {
        // If we have a disposal callback, call it here
        // This should be set via constructor or separately
      }
    }
    this.pool = [];
  }

  /**
   * Get all active instances for iteration.
   */
  getActiveInstances(): T[] {
    return this.pool.filter(p => p.isActive).map(p => p.instance);
  }
}
