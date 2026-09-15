/**
 * EntityPool — generic pool for game entities (enemies, obstacles, power-ups).
 * Pre-warmed at construction; acquire() returns an object with reset(entityData) call.
 */
import { ObjectPool } from './ObjectPool.js';

export class EntityPool extends ObjectPool {
  /**
   * @param {number} initialCapacity - Number of pre-allocated entities
   * @param {Function} factoryFn - Called to create a new entity when pool is exhausted
   */
  constructor(initialCapacity = 80, factoryFn) {
    super(factoryFn || (() => ({})), initialCapacity);
  }

  /**
   * Acquire an entity and reset it with provided data.
   * @param {Object} data - Entity initialization data (position, type, etc.)
   * @returns {Object} The pooled entity instance
   */
  acquire(data = {}) {
    const entity = super.acquire();
    if (entity.reset) {
      entity.reset(data);
    } else {
      Object.assign(entity, data);
    }
    return entity;
  }

  /**
   * Release all entities back to the pool. Called during wave transitions.
   */
  releaseAll() {
    while (this._pool.length > 0) {
      const entity = this._pool.pop();
      if (entity.dispose && typeof entity.dispose === 'function') {
        entity.dispose();
      }
    }
  }

  /**
   * Dispose all pooled objects and clear the pool. Call on game shutdown.
   */
  dispose() {
    this.releaseAll();
    super.dispose();
  }
}
