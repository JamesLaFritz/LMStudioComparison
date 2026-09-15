/**
 * Generic Object Pool for recycling objects to reduce GC pressure.
 */
export class ObjectPool {
    constructor(factory, initialCapacity = 100) {
        this.factory = factory;
        this.pool = [];
        this.activeObjects = [];

        // Pre-allocate
        for (let i = 0; i < initialCapacity; i++) {
            const obj = factory();
            if (obj && typeof obj.reset === 'function') obj.reset();
            this.pool.push(obj);
        }
    }

    acquire() {
        let obj = this.pool.pop();
        if (!obj) {
            obj = this.factory();
        }
        this.activeObjects.push(obj);
        return obj;
    }

    release(obj) {
        const idx = this.activeObjects.indexOf(obj);
        if (idx !== -1) {
            this.activeObjects.splice(idx, 1);
            if (typeof obj.reset === 'function') obj.reset();
            this.pool.push(obj);
        }
    }

    releaseAll() {
        for (const obj of this.activeObjects) {
            if (typeof obj.reset === 'function') obj.reset();
            this.pool.push(obj);
        }
        this.activeObjects.length = 0;
    }

    get activeCount() { return this.activeObjects.length; }
    get poolSize() { return this.pool.length; }
}
