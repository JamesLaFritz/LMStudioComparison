/**
 * Generic Object Pool Implementation
 * Pre-allocates objects and recycles them to prevent garbage collection spikes
 */

export class ObjectPool {
  /**
   * @param {Function} factory - Function that creates a new object instance
   * @param {number} initialSize - Number of objects to pre-create
   * @param {Function} [resetFn] - Function to reset an object to default state (optional)
   */
  constructor(factory, initialSize = 10, resetFn = null) {
    this.factory = factory;
    this.resetFn = resetFn || (() => {});
    
    /** @type {Array<Object>} */
    this.pool = [];
    
    // Pre-allocate objects
    for (let i = 0; i < initialSize; i++) {
      const obj = factory();
      if (obj) {
        this.resetFn(obj);
        this.pool.push(obj);
      }
    }
  }

  /**
   * Acquire an object from the pool
   * @returns {Object|null} - An available object, or null if pool exhausted and cannot expand
   */
  acquire() {
    if (this.pool.length === 0) {
      // Try to create a new object if factory allows dynamic expansion
      const newObj = this.factory();
      if (newObj) {
        return newObj;
      }
      return null;
    }
    
    const obj = this.pool.pop();
    this.resetFn(obj);
    return obj;
  }

  /**
   * Release an object back to the pool
   * @param {Object} obj - The object to recycle
   */
  release(obj) {
    if (!obj) return;
    
    // Reset object state before returning to pool
    this.resetFn(obj);
    
    // Add back to pool (with optional max size limit)
    this.pool.push(obj);
  }

  /**
   * Release all objects back to the pool and clear active references
   */
  releaseAll() {
    // This method should be called by the consumer to return all borrowed objects
    // The pool itself doesn't track what's been acquired, only what's available
  }

  /**
   * Get current pool statistics
   * @returns {{available: number, inUse: number}}
   */
  getStats() {
    const total = this.pool.length + (this.initialSize || 0);
    return {
      available: this.pool.length,
      inUse: Math.max(0, total - this.pool.length)
    };
  }

  /**
   * Pre-warm the pool to a specific size
   * @param {number} targetSize 
   */
  warmUp(targetSize) {
    while (this.pool.length < targetSize) {
      const obj = this.factory();
      if (!obj) break;
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  /**
   * Clear the pool entirely (useful for scene transitions)
   */
  clear() {
    while (this.pool.length > 0) {
      const obj = this.pool.pop();
      // Call reset one final time before discarding
      this.resetFn(obj);
    }
  }
}

/**
 * Specialized pool for Three.js Mesh objects with automatic disposal handling
 */
export class MeshPool extends ObjectPool {
  /**
   * @param {THREE.Geometry} geometry - Shared geometry for all pooled meshes
   * @param {THREE.Material} material - Shared material (cloned per mesh if needed)
   * @param {number} initialSize 
   * @param {boolean} cloneMaterial - Whether to clone the material for each mesh
   */
  constructor(geometry, material, initialSize = 10, cloneMaterial = false) {
    const factory = () => {
      const meshGeo = cloneMaterial ? geometry.clone() : geometry;
      const meshMat = cloneMaterial ? material.clone() : material;
      return new THREE.Mesh(meshGeo, meshMat);
    };

    const resetFn = (mesh) => {
      mesh.visible = false;
      mesh.position.set(0, 0, 0);
      mesh.scale.set(1, 1, 1);
      mesh.rotation.set(0, 0, 0);
      mesh.matrix.identity();
      mesh.matrixWorld.identity();
    };

    super(factory, initialSize, resetFn);
    
    // Store references for cleanup
    this.geometry = geometry;
    this.material = material;
    this.cloneMaterial = cloneMaterial;
  }

  /**
   * Dispose of the pool and all its resources
   */
  dispose() {
    const meshes = [...this.pool];
    
    // If cloning materials, we need to dispose each one
    if (this.cloneMaterial) {
      for (const mesh of meshes) {
        if (mesh.material) {
          mesh.material.dispose();
        }
        if (mesh.geometry && mesh.geometry !== this.geometry) {
          mesh.geometry.dispose();
        }
      }
    }
    
    // Don't dispose shared geometry/material - they're managed elsewhere
    super.clear();
  }
}

/**
 * Typed pool for primitive values (numbers, vectors, etc.)
 */
export class PrimitivePool {
  /**
   * @param {'number'|'Vector3'|'Vector2'|'Color'} type 
   * @param {number} initialSize 
   */
  constructor(type = 'number', initialSize = 10) {
    this.type = type;
    this.pool = [];
    
    // Pre-allocate based on type
    for (let i = 0; i < initialSize; i++) {
      switch (type) {
        case 'Vector3':
          this.pool.push(new THREE.Vector3());
          break;
        case 'Vector2':
          this.pool.push(new THREE.Vector2());
          break;
        case 'Color':
          this.pool.push(new THREE.Color());
          break;
        default:
          this.pool.push(0);
      }
    }
  }

  acquire() {
    if (this.pool.length === 0) {
      // Create new instance if pool exhausted
      switch (this.type) {
        case 'Vector3':
          return new THREE.Vector3();
        case 'Vector2':
          return new THREE.Vector2();
        case 'Color':
          return new THREE.Color();
        default:
          return 0;
      }
    }
    
    const item = this.pool.pop();
    
    // Reset based on type
    switch (this.type) {
      case 'Vector3':
        item.set(0, 0, 0);
        break;
      case 'Vector2':
        item.set(0, 0);
        break;
      case 'Color':
        item.setHex(0x000000);
        break;
      default:
        return 0;
    }
    
    return item;
  }

  release(item) {
    if (item === undefined || item === null) return;
    
    // Reset before returning to pool
    switch (this.type) {
      case 'Vector3':
        item.set(0, 0, 0);
        break;
      case 'Vector2':
        item.set(0, 0);
        break;
      case 'Color':
        item.setHex(0x000000);
        break;
    }
    
    this.pool.push(item);
  }

  clear() {
    this.pool = [];
  }
}
