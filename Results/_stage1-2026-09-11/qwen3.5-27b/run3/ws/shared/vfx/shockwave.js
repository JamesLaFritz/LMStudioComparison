// shared/vfx/shockwave.js
// Expanding emissive rings on impacts/deaths

import * as THREE from 'three';

/**
 * ShockwaveManager - Creates and manages expanding shockwave rings
 * Uses pooled RingGeometry meshes with additive blending for neon glow effect
 */
export class ShockwaveManager {
  constructor(scene) {
    this.scene = scene;
    this.shockwaves = [];
    
    // Pre-create base geometry (will be cloned for each shockwave)
    this.baseGeometry = new THREE.RingGeometry(0.1, 0.25, 48);
    this.baseGeometry.rotateX(-Math.PI / 2); // Lie flat on XZ plane
    
    // Base material properties (cloned per shockwave for independent opacity)
    this.baseMaterialProps = {
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      emissive: 0xffffff,
      emissiveIntensity: 2.0
    };
    
    // Pool for recycled shockwave meshes
    this.pool = [];
    this.maxPoolSize = 50;
  }

  /**
   * Spawn a shockwave at the given position
   * @param {THREE.Vector3} position - World space position
   * @param {number} radiusMax - Maximum expansion radius (default: 2)
   * @param {number} duration - Animation duration in seconds (default: 0.4)
   * @param {number} color - Hex color value (default: white)
   * @returns {THREE.Mesh} The shockwave mesh
   */
  spawn(position, radiusMax = 2, duration = 0.4, color = 0xffffff) {
    let shockwave;

    // Try to get from pool first
    if (this.pool.length > 0) {
      shockwave = this.pool.pop();
      shockwave.active = true;
      shockwave.radiusMax = radiusMax;
      shockwave.duration = duration;
      shockwave.startTime = performance.now() / 1000;
      shockwave.position.copy(position);
      
      // Update color if different
      if (color !== shockwave.color) {
        shockwave.mesh.material.color.setHex(color);
        shockwave.mesh.material.emissive.setHex(color);
        shockwave.color = color;
      }
      
      this.scene.add(shockwave.mesh);
    } else {
      // Create new shockwave
      const geometry = this.baseGeometry.clone();
      const material = new THREE.MeshBasicMaterial({ ...this.baseMaterialProps });
      material.color.setHex(color);
      material.emissive.setHex(color);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      
      shockwave = {
        mesh: mesh,
        radiusMax: radiusMax,
        duration: duration,
        startTime: performance.now() / 1000,
        color: color,
        active: true
      };

      this.scene.add(mesh);
    }

    this.shockwaves.push(shockwave);
    return shockwave.mesh;
  }

  /**
   * Update all active shockwaves
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    const now = performance.now() / 1000;

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      const age = now - sw.startTime;
      const t = age / sw.duration;

      if (t >= 1.0) {
        // Animation complete - recycle or dispose
        this.recycleShockwave(sw);
        this.shockwaves.splice(i, 1);
        continue;
      }

      // Scale up based on progress (ease-out for dramatic effect)
      const easeOut = 1 - Math.pow(1 - t, 3);
      const scale = (0.5 + easeOut * 4) * (sw.radiusMax / 2);
      
      sw.mesh.scale.set(scale, scale, 1);
      
      // Fade out with opacity curve (bright at start and end, dim in middle)
      const opacity = Math.sin(t * Math.PI) * 0.8;
      sw.mesh.material.opacity = opacity;
      
      // Pulsing emissive intensity
      const emissiveIntensity = 2 + Math.sin(t * Math.PI * 4) * 1.5;
      sw.mesh.material.emissiveIntensity = emissiveIntensity;
    }
  }

  /**
   * Recycle a shockwave back to the pool
   */
  recycleShockwave(shockwave) {
    if (this.pool.length < this.maxPoolSize) {
      // Hide and reset for reuse
      shockwave.mesh.visible = false;
      shockwave.mesh.position.set(9999, 9999, 9999);
      shockwave.active = false;
      
      this.scene.remove(shockwave.mesh);
      this.pool.push(shockwave);
    } else {
      // Pool is full - dispose completely
      this.scene.remove(shockwave.mesh);
      shockwave.mesh.geometry.dispose();
      shockwave.mesh.material.dispose();
    }
  }

  /**
   * Clear all active shockwaves immediately
   */
  clear() {
    for (const sw of this.shockwaves) {
      this.scene.remove(sw.mesh);
      sw.mesh.geometry.dispose();
      sw.mesh.material.dispose();
    }
    this.shockwaves = [];
    
    // Also clear pool
    for (const sw of this.pool) {
      this.scene.remove(sw.mesh);
      sw.mesh.geometry.dispose();
      sw.mesh.material.dispose();
    }
    this.pool = [];
  }

  /**
   * Dispose all resources and clean up
   */
  dispose() {
    this.clear();
    
    // Dispose base geometry (not used anymore)
    if (this.baseGeometry) {
      this.baseGeometry.dispose();
      this.baseGeometry = null;
    }
  }

  /**
   * Get count of active shockwaves
   */
  getActiveCount() {
    return this.shockwaves.length;
  }
}

/**
 * Create a shockwave with custom visual properties for special effects
 * @param {ShockwaveManager} manager - The shockwave manager instance
 * @param {THREE.Vector3} position - World space position
 * @param {object} options - Customization options
 * @returns {THREE.Mesh} The custom shockwave mesh
 */
export function spawnCustomShockwave(manager, position, options = {}) {
  const {
    radiusMax = 2,
    duration = 0.4,
    color = 0xffffff,
    innerRadius = 0.1,
    outerRadius = 0.25,
    segments = 48,
    pulseSpeed = 1
  } = options;

  // For truly custom shockwaves, create a dedicated mesh outside the pool
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    emissive: color,
    emissiveIntensity: 3.0
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  
  manager.scene.add(mesh);

  // Add to a separate custom shockwaves array if needed
  // For now, just return the mesh and let caller manage it
  
  return { mesh, geometry, material };
}
