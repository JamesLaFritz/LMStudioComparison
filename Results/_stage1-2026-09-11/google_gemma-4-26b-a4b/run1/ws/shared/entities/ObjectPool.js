/**
 * A high-performance, generic object pool to minimize GC pressure and allocation overhead.
 * Part of the AAA Retro-Futurism Engine Core.
 */
export class ObjectPool {
    /**
     * @param {Function} factory - Function that returns a new instance of the object.
     * @param {number} initialSize - Number of objects to pre-allocate.
     */
    constructor(factory, initialSize = 10) {
        this._factory = factory;
        this._pool = [];

        for (let i = 0; i < initialSize; i++) {
            this._pool.push(this._factory());
        }
    }

    /**
     * Retrieves an object from the pool. If the pool is empty, creates a new one.
     * @returns {*} An instance of the pooled object.
     */
    acquire() {
        if (this._pool.length > 0) {
            const obj = this._pool.pop();
            // Reset logic should be handled by the object itself or via an interface
            if (typeof obj.reset === 'function') {
                obj.reset();
            }
            return obj;
        }
        return this._factory();
    }

    /**
     * Returns an object to the pool for future reuse.
     * @param {*} obj - The object to return.
     */
    release(obj) {
        // Ensure we don't grow the pool infinitely with unique references
        this._pool.push(obj);
    }

    /**
     * Returns the current number of available objects in the pool.
     * @returns {number}
     */
    get size() {
        return this._pool.length;
    }

    /**
     * Clears the pool and allows for GC.
     */
    dispose() {
        while (this._pool.length > 0) {
            const obj = this._pool.pop();
            if (typeof obj.dispose === 'function') {
                obj.dispose();
            }
        }
        this._pool = [];
    }
}
