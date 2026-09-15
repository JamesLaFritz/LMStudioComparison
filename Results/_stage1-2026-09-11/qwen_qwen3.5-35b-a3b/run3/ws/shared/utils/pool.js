/**
 * Generic Object Pool for Three.js entities and game objects.
 * Implements LRU (Least Recently Used) eviction strategy.
 */
export class ObjectPool {
  constructor(factory, resetFn, maxSize = 100) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    
    // Pre-allocate pool array
    this.pool = [];
    for (let i = 0; i < maxSize; i++) {
      this.pool.push(factory());
    }
    
    // Track usage: active count and LRU order
    this.activeCount = 0;
    this.lruOrder = new Array(maxSize).fill(0); // timestamp of last use
    this.lastTimestamp = 0;
  }

  /**
   * Acquire an object from the pool.
   * @returns {any} An initialized object, or null if pool exhausted.
   */
  acquire() {
    const now = Date.now();
    
    // Find least recently used inactive object
    let bestIndex = -1;
    let minLru = Infinity;
    
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        const lruScore = this.lruOrder[i];
        if (lruScore < minLru) {
          minLru = lruScore;
          bestIndex = i;
        }
      }
    }
    
    // If no inactive object, return null (pool exhausted)
    if (bestIndex === -1) {
      console.warn('ObjectPool exhausted: returning null');
      return null;
    }
    
    const obj = this.pool[bestIndex];
    obj.active = true;
    this.lruOrder[bestIndex] = now;
    this.activeCount++;
    
    // Reset object state if provided
    if (this.resetFn) {
      this.resetFn(obj);
    }
    
    return obj;
  }

  /**
   * Release an object back to the pool.
   * @param {any} obj - The object to release.
   */
  release(obj) {
    const index = this.pool.indexOf(obj);
    if (index === -1) {
      console.error('ObjectPool: attempting to release unknown object');
      return;
    }
    
    obj.active = false;
    this.lruOrder[index] = Date.now();
    this.activeCount--;
  }

  /**
   * Clear all objects from the pool (call on game reset).
   */
  clear() {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        console.warn(`ObjectPool: clearing active object at index ${i}`);
      }
      this.pool[i].active = false;
      this.lruOrder[i] = 0;
    }
    this.activeCount = 0;
  }

  /**
   * Get current pool statistics.
   * @returns {{ total: number, active: number, available: number }}
   */
  getStats() {
    return {
      total: this.pool.length,
      active: this.activeCount,
      available: this.pool.length - this.activeCount
    };
  }

  /**
   * Dispose all objects and release resources.
   * Call when game is destroyed.
   */
  dispose() {
    for (const obj of this.pool) {
      if (obj.dispose && typeof obj.dispose === 'function') {
        obj.dispose();
      }
    }
    this.pool = [];
    this.activeCount = 0;
  }
}

/**
 * Specialized pool for Three.js meshes with automatic disposal.
 */
export class MeshPool extends ObjectPool {
  constructor(geometry, material, count) {
    super(
      () => {
        const mesh = new THREE.Mesh(geometry.clone(), material.clone());
        mesh.visible = false;
        return mesh;
      },
      (mesh) => {
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        mesh.scale.set(1, 1, 1);
        mesh.visible = true;
      },
      count
    );
    
    this.geometry = geometry;
    this.material = material;
  }

  dispose() {
    super.dispose();
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
  }
}