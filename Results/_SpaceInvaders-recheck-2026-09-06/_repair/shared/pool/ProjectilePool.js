import * as THREE from 'three';   // [REPAIR 2026-09-06 - not model output]
import { ObjectPool } from './ObjectPool.js';

/**
 * ProjectilePool — specialized object pool for game projectiles.
 * Pre-warmed to 200 capacity. Each projectile is a plain data object
 * with: mesh, velocity (Vec3), active boolean, owner ('player'|'enemy'), damage.
 */
export class ProjectilePool extends ObjectPool {
  /**
   * @param {number} initialCapacity - Number of pre-allocated projectiles
   */
  constructor(initialCapacity = 200) {
    super(initialCapacity);
  }

  /**
   * Factory function: creates a fresh projectile data object.
   * @returns {{ mesh: import('three').Mesh|null, velocity: import('three').Vector3, active: boolean, owner: string, damage: number, life: number }}
   */
  _createItem() {
    const THREE = window.THREE;
    return {
      mesh: null,
      velocity: new THREE.Vector3(0, 0, 0),
      active: false,
      owner: 'player', // 'player' or 'enemy'
      damage: 1,
      life: 0, // seconds until auto-despawn
    };
  }

  /**
   * Reset a projectile back to inactive state.
   * @param {object} item - The projectile data object to reset
   */
  _resetItem(item) {
    if (item.mesh) {
      item.mesh.visible = false;
    }
    item.velocity.set(0, 0, 0);
    item.active = false;
    item.owner = 'player';
    item.damage = 1;
    item.life = 0;
  }

  /**
   * Acquire and activate a projectile.
   * @param {import('three').Mesh} mesh - The Three.js mesh to attach
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} z - World Z position
   * @param {string} owner - 'player' or 'enemy'
   * @returns {{ mesh: import('three').Mesh, velocity: import('three').Vector3, active: boolean, owner: string, damage: number, life: number }}
   */
  acquire(mesh, x, y, z, owner = 'player') {
    const item = super.acquire();
    item.mesh = mesh;
    if (mesh) {
      mesh.position.set(x, y, z);
      mesh.visible = true;
    }
    item.active = true;
    item.owner = owner;
    return item;
  }

  /**
   * Release a projectile back to the pool.
   * @param {{ mesh: import('three').Mesh|null }} item - The projectile data object
   */
  release(item) {
    if (item.mesh) {
      item.mesh.visible = false;
    }
    super.release(item);
  }

  /**
   * Clear all items from the pool and dispose meshes.
   * @param {Function} disposeCallback - Function to dispose each mesh
   */
  clear(disposeCallback) {
    for (const item of this._pool) {
      if (item.mesh && disposeCallback) {
        disposeCallback(item.mesh);
      }
    }
    super.clear();
  }
}
