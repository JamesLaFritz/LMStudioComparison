import * as THREE from 'three';

/**
 * Motion Trails System
 * Records position history of fast-moving objects and renders fading trails
 */
export class MotionTrails {
  constructor(maxObjects = 100, trailLength = 20) {
    this.maxObjects = maxObjects;
    this.trailLength = trailLength;
    
    // Map: objectID -> array of Vector3 positions
    this.trailData = new Map();
    
    // Line materials for different trail types
    this.materials = {
      playerBullet: new THREE.LineBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      }),
      enemyBullet: new THREE.LineBasicMaterial({ 
        color: 0xff0000, 
        transparent: true, 
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      }),
      default: new THREE.LineBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.6,
        blending: THREE.AdditiveBlending
      })
    };
    
    // Active trail meshes for rendering
    this.trailMeshes = [];
  }

  /**
   * Record a position for an object's trail
   */
  record(objectId, position, type = 'default') {
    if (!this.trailData.has(objectId)) {
      this.trailData.set(objectId, []);
    }
    
    const history = this.trailData.get(objectId);
    history.push(position.clone());
    
    // Trim to max length (remove oldest)
    while (history.length > this.trailLength) {
      history.shift();
    }
  }

  /**
   * Clear trail data for an object
   */
  clear(objectId) {
    if (this.trailData.has(objectId)) {
      this.trailData.delete(objectId);
      
      // Remove associated mesh
      const index = this.trailMeshes.findIndex(m => m.userData.objectId === objectId);
      if (index !== -1) {
        const mesh = this.trailMeshes[index];
        mesh.geometry.dispose();
        this.trailMeshes.splice(index, 1);
      }
    }
  }

  /**
   * Clear all trails
   */
  clearAll() {
    // Dispose all trail meshes
    for (const mesh of this.trailMeshes) {
      mesh.geometry.dispose();
    }
    this.trailMeshes = [];
    
    // Clear all data
    this.trailData.clear();
  }

  /**
   * Update and render trails - call each frame
   */
  update(scene, deltaTime) {
    // Fade out trail opacity over time
    for (const mesh of this.trailMeshes) {
      const material = mesh.material;
      if (material.opacity > 0.1) {
        material.opacity -= deltaTime * 2; // Fade at 2 per second
      } else {
        material.opacity = 0;
      }
    }

    // Remove fully faded trails
    this.trailMeshes = this.trailMeshes.filter(mesh => mesh.material.opacity > 0);
    
    // Update trail positions for active objects
    for (const [objectId, history] of this.trailData.entries()) {
      if (history.length < 2) continue;
      
      // Check if we already have a mesh for this object
      let mesh = this.trailMeshes.find(m => m.userData.objectId === objectId);
      
      if (!mesh || mesh.material.opacity <= 0.1) {
        // Create new trail mesh
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        
        for (const pos of history) {
          positions.push(pos.x, pos.y, pos.z);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        // Determine material type from userData or default
        const type = this.trailData.get(objectId)?.userData?.trailType || 'default';
        const material = this.materials[type] || this.materials.default;
        
        mesh = new THREE.Line(geometry, material.clone());
        mesh.userData.objectId = objectId;
        scene.add(mesh);
        this.trailMeshes.push(mesh);
      } else {
        // Update existing mesh positions
        const positions = [];
        for (const pos of history) {
          positions.push(pos.x, pos.y, pos.z);
        }
        
        const positionAttribute = mesh.geometry.attributes.position;
        positionAttribute.needsUpdate = true;
        
        // Rebuild geometry if point count changed
        if (positionAttribute.count !== history.length) {
          mesh.geometry.dispose();
          mesh.geometry = new THREE.BufferGeometry();
          mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        } else {
          positionAttribute.array.set(positions);
        }
      }
    }
    
    // Clean up trail data for objects with no recent updates (optional)
    // This prevents memory leaks if record() stops being called
  }

  /**
   * Get the number of active trails
   */
  getActiveCount() {
    return this.trailMeshes.length;
  }

  dispose() {
    this.clearAll();
    
    for (const material of Object.values(this.materials)) {
      material.dispose();
    }
  }
}
