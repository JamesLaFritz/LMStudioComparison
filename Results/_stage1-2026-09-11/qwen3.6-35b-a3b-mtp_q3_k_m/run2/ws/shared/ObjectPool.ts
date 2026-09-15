/**
 * Generic typed object pool for reuse without GC pressure.
 * T must have a reset() method called on acquire/release.
 */
export interface Poolable<T extends { reset(): void }> {
    reset(...args: unknown[]): void;
}

export class ObjectPool<T extends { reset(): void }> {
    private pool: T[] = [];
    private active: Set<T> = new Set();
    private readonly createFn: () => T;
    private readonly maxCount: number;

    constructor(createFn: () => T, maxCount: number) {
        this.createFn = createFn;
        this.maxCount = maxCount;
        // Pre-warm the pool
        for (let i = 0; i < maxCount; i++) {
            const obj = createFn();
            this.pool.push(obj);
        }
    }

    acquire(...args: unknown[]): T | null {
        if (this.pool.length === 0) return null;
        const obj = this.pool.pop()!;
        obj.reset(...args);
        this.active.add(obj);
        return obj;
    }

    release(obj: T): void {
        if (!this.active.has(obj)) return;
        this.active.delete(obj);
        this.pool.push(obj);
    }

    get size(): number {
        return this.active.size;
    }

    get available(): number {
        return this.pool.length;
    }

    forEachActive(callback: (obj: T) => void): void {
        for (const obj of this.active) {
            callback(obj);
        }
    }

    dispose(): void {
        for (const obj of this.active) {
            if ((obj as unknown as { dispose?: () => void }).dispose) {
                (obj as unknown as { dispose: () => void }).dispose();
            }
        }
        for (const obj of this.pool) {
            if ((obj as unknown as { dispose?: () => void }).dispose) {
                (obj as unknown as { dispose: () => void }).dispose();
            }
        }
        this.pool = [];
        this.active.clear();
    }
}
