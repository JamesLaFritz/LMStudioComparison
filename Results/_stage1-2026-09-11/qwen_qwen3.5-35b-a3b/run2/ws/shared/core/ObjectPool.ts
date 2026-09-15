import { Vector3 } from 'three';

export interface PooledObject<T> {
    instance: T;
    active: boolean;
}

export class ObjectPool<T extends { activate(): void, deactivate(): void }> {
    private pool: Array<PooledObject<T>> = [];
    private factory: () => T;
    private maxSize: number;

    constructor(factory: () => T, maxSize: number) {
        this.factory = factory;
        this.maxSize = maxSize;
        
        // Pre-allocate pool
        for (let i = 0; i < maxSize; i++) {
            const instance = factory();
            this.pool.push({
                instance: instance,
                active: false
            });
            instance.deactivate();
        }
    }

    public get(): T | null {
        // Find inactive object
        for (const item of this.pool) {
            if (!item.active) {
                item.active = true;
                item.instance.activate();
                return item.instance;
            }
        }
        
        // Pool exhausted - return null or expand if needed
        return null;
    }

    public release(obj: T): void {
        for (const item of this.pool) {
            if (item.instance === obj && item.active) {
                item.active = false;
                obj.deactivate();
                return;
            }
        }
    }

    public getAllActive(): Array<T> {
        const active: T[] = [];
        for (const item of this.pool) {
            if (item.active) {
                active.push(item.instance);
            }
        }
        return active;
    }

    public size(): number {
        return this.pool.length;
    }

    public activeCount(): number {
        let count = 0;
        for (const item of this.pool) {
            if (item.active) count++;
        }
        return count;
    }
}