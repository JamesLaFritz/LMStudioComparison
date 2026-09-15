/**
 * ObjectPool - Generic object pooling template for zero-allocation gameplay
 * Pre-warms pool on initialization to prevent runtime GC pressure
 */

export class ObjectPool {
    /**
     * @param {Function} factory - Function that creates a new instance
     * @param {number} size - Pool capacity
     * @param {Function} resetFn - Optional function to call when releasing an object
     */
    constructor(factory, size = 100, resetFn = null) {
        this.factory = factory;
        this.resetFn = resetFn;
        this.size = size;
        
        // Available objects (ready to acquire)
        this.available = [];
        
        // Pre-warm the pool
        for (let i = 0; i < size; i++) {
            const instance = factory();
            if (instance && typeof instance.reset === 'function') {
                instance.reset();
            }
            this.available.push(instance);
        }
    }

    /**
     * Acquire an object from the pool
     * @returns {Object|null} - An object from the pool, or null if exhausted
     */
    acquire() {
        if (this.available.length === 0) {
            // Pool exhausted - create overflow instance (not pooled)
            return this.factory();
        }
        
        const obj = this.available.pop();
        if (obj && typeof obj.reset === 'function') {
            obj.reset();
        }
        return obj;
    }

    /**
     * Release an object back to the pool
     * @param {Object} obj - The object to release
     */
    release(obj) {
        if (!obj) return;
        
        // Call reset function if provided externally
        if (this.resetFn) {
            this.resetFn(obj);
        } else if (typeof obj.reset === 'function') {
            obj.reset();
        }
        
        // Only pool objects up to capacity
        if (this.available.length < this.size) {
            this.available.push(obj);
        }
        // Otherwise let it be garbage collected (overflow case)
    }

    /**
     * Release all available objects back to their initial state
     */
    releaseAll() {
        while (this.available.length > 0) {
            const obj = this.available.pop();
            if (obj && typeof obj.reset === 'function') {
                obj.reset();
            }
        }
    }

    /**
     * Get current pool statistics
     */
    getStats() {
        return {
            total: this.size,
            available: this.available.length,
            inUse: this.size - this.available.length,
            utilization: ((this.size - this.available.length) / this.size) * 100
        };
    }

    /**
     * Expand pool capacity if needed
     */
    expand(additionalSize = 50) {
        for (let i = 0; i < additionalSize; i++) {
            const instance = this.factory();
            if (instance && typeof instance.reset === 'function') {
                instance.reset();
            }
            this.available.push(instance);
        }
        this.size += additionalSize;
    }
}

/**
 * EntityPool - Specialized pool for game entities with Three.js cleanup
 */
export class EntityPool extends ObjectPool {
    constructor(factory, size = 100) {
        super(factory, size, (entity) => {
            // Reset entity position and visibility
            if (entity.position) {
                entity.position.set(0, -999, 0);
            }
            if (typeof entity.visible !== 'undefined') {
                entity.visible = false;
            }
        });
    }
}

export default ObjectPool;
