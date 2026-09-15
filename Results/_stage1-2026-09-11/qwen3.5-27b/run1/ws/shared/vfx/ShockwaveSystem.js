import * as THREE from 'three';

/**
 * Shockwave System - Expanding emissive rings on impacts/deaths
 * Creates torus meshes that scale up and fade out over time
 */
export class ShockwaveSystem {
  constructor(scene) {
    this.scene = scene;
    this.shockwaves = [];
    
    // Shared geometry for all shockwaves (efficient reuse)
    this.geometry = new THREE.TorusGeometry(1, 0.2, 8, 64);
    
    // Base material - each shockwave gets a clone with its own opacity
    this.baseMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00ffff,
      emissiveIntensity: 3,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  /**
   * Spawn a shockwave at the given world position
   * @param {THREE.Vector3} position - World space position
   * @param {number} colorHex - Emissive color (default cyan)
   * @param {number} maxScale - Maximum expansion scale (default 3)
   * @param {number} lifetime - Duration in seconds (default 0.5)
   */
  spawn(position, colorHex = 0x00ffff, maxScale = 3, lifetime = 0.5) {
    const material = this.baseMaterial.clone();
    material.emissive.setHex(colorHex);
    
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.position.copy(position);
    mesh.rotation.x = Math.PI / 2; // Lay flat on XZ plane
    
    mesh.scale.set(0.1, 0.1, 0.1);
    mesh.userData = {
      maxScale: maxScale,
      lifetime: lifetime,
      birthTime: performance.now() / 1000
    };
    
    this.scene.add(mesh);
    this.shockwaves.push(mesh);
  }

  /**
   * Update all active shockwaves - scale up and fade out
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    const now = performance.now() / 1000;
    
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      const age = now - sw.userData.birthTime;
      const progress = Math.min(age / sw.userData.lifetime, 1);
      
      // Scale up linearly
      const currentScale = progress * sw.userData.maxScale;
      sw.scale.setScalar(currentScale);
      
      // Fade out using ease-out curve
      const opacity = (1 - progress) ** 2;
      sw.material.opacity = opacity;
      
      // Remove when expired
      if (age >= sw.userData.lifetime) {
        this.scene.remove(sw);
        sw.material.dispose();
        this.shockwaves.splice(i, 1);
      }
    }
  }

  /**
   * Render shockwaves - called after update
   */
  render() {
    // Shockwaves are already in the scene, just need to ensure they're rendered
    // The renderer handles them automatically as part of the scene
  }

  /**
   * Clear all active shockwaves immediately
   */
  clear() {
    for (const sw of this.shockwaves) {
      this.scene.remove(sw);
      sw.material.dispose();
    }
    this.shockwaves = [];
  }

  /**
   * Dispose all resources - call when game ends or scene changes
   */
  dispose() {
    this.clear();
    this.geometry.dispose();
    this.baseMaterial.dispose();
  }
}
