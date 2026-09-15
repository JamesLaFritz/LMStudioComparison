import * as THREE from 'three';

export interface PooledObject<T> {
  object: T;
  active: boolean;
}

export class ObjectPool<T extends THREE.Object3D> {
  private pool: T[] = [];
  private activeList: T[] = [];
  private factory: () => T;
  private maxCapacity: number;

  constructor(factory: () => T, maxCapacity: number = 100) {
    this.factory = factory;
    this.maxCapacity = maxCapacity;
  }

  acquire(): T | null {
    // Try to reuse an inactive object from the pool
    for (let i = 0; i < this.pool.length; i++) {
      const obj = this.pool[i];
      if (!obj.userData.active) {
        obj.visible = true;
        obj.userData.active = true;
        this.activeList.push(obj);
        return obj;
      }
    }

    // Pool is exhausted, create a new one if under capacity
    if (this.pool.length < this.maxCapacity) {
      const newObj = this.factory();
      newObj.visible = true;
      newObj.userData.active = true;
      this.pool.push(newObj);
      this.activeList.push(newObj);
      return newObj;
    }

    // At capacity, return null (caller should handle gracefully)
    return null;
  }

  release(obj: T): void {
    obj.visible = false;
    obj.userData.active = false;
    const idx = this.activeList.indexOf(obj);
    if (idx !== -1) {
      this.activeList.splice(idx, 1);
    }
  }

  updateActiveState(obj: THREE.Object3D, active: boolean): void {
    obj.visible = active;
    obj.userData.active = active;
  }

  getActiveObjects(): T[] {
    return [...this.activeList];
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  disposeAll(): void {
    for (const obj of this.pool) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
    this.pool = [];
    this.activeList = [];
  }
}
