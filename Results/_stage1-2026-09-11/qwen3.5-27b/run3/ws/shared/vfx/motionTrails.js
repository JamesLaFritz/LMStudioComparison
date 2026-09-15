/**
 * Motion Trail Renderer - Creates trailing ribbon effects for fast-moving objects
 * Uses history buffer of positions to generate fading trail ribbons
 */

import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, Mesh } from 'three';

export class MotionTrailRenderer {
  constructor(maxSegments = 10) {
    this.maxSegments = maxSegments;
    this.trails = new Map(); // objectID -> TrailData
  }

  /**
   * Add a motion trail to an object
   * @param {THREE.Object3D} object - The object to trail
   * @param {number|string|THREE.Color} color - Trail color
   * @param {number} thickness - Trail width (default: 0.15)
   */
  add(object, color = '#ffffff', thickness = 0.15) {
    const id = object.id || Math.random();
    
    this.trails.set(id, {
      positions: [],           // History buffer of Vector3s
      color: typeof color === 'string' ? new THREE.Color(color) : color,
      thickness: thickness,
      geometry: null,          // Created on first update with enough data
      mesh: null,
      objectRef: object        // Weak reference tracking
    });
  }

  /**
   * Remove a trail from an object
   */
  remove(object) {
    const id = object.id || this.findIdByObject(object);
    if (id !== undefined && this.trails.has(id)) {
      this.disposeTrail(this.trails.get(id));
      this.trails.delete(id);
    }
  }

  /**
   * Find trail ID by searching all trails for matching object reference
   */
  findIdByObject(object) {
    for (const [id, trail] of this.trails.entries()) {
      if (trail.objectRef === object) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Update all trails - call each frame with the scene and objects to track
   */
  update(scene, objectsToTrack = []) {
    // Update only the specified objects (for performance)
    for (const object of objectsToTrack) {
      const id = object.id || this.findIdByObject(object);
      if (!id || !this.trails.has(id)) continue;

      const trail = this.trails.get(id);
      
      // Push current position to history
      trail.positions.push(object.position.clone());
      
      // Maintain max length (FIFO - remove oldest)
      while (trail.positions.length > this.maxSegments) {
        trail.positions.shift();
      }

      // Update ribbon geometry if we have enough points
      if (trail.positions.length >= 2 && trail.mesh !== null) {
        this.updateTrailGeometry(trail);
      } else if (trail.positions.length >= 3 && trail.mesh === null) {
        // Need at least 3 points to create a visible ribbon
        this.createTrailMesh(trail, scene);
      }
    }

    // Clean up trails for objects that no longer exist in scene
    for (const [id, trail] of this.trails.entries()) {
      if (!scene.children.includes(trail.mesh)) {
        this.disposeTrail(trail);
        this.trails.delete(id);
      }
    }
  }

  /**
   * Create the initial mesh for a trail
   */
  createTrailMesh(trail, scene) {
    const geometry = new BufferGeometry();
    
    // Initial attributes (will be updated in updateTrailGeometry)
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(0), 3));
    geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(0), 4));
    
    const material = new MeshBasicMaterial({ 
      vertexColors: true, 
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    trail.mesh = new Mesh(geometry, material);
    scene.add(trail.mesh);
  }

  /**
   * Update the geometry of an existing trail mesh
   */
  updateTrailGeometry(trail) {
    const positions = [];
    const colors = [];
    
    // Generate ribbon quads along the path
    for (let i = 0; i < trail.positions.length - 1; i++) {
      const p1 = trail.positions[i];
      const p2 = trail.positions[i + 1];
      
      // Calculate direction vector between points
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      
      // Create perpendicular vector for ribbon width (in XZ plane)
      const right = new THREE.Vector3(-dir.z, 0, dir.x);
      if (right.lengthSq() === 0) {
        right.set(1, 0, 0); // Fallback if direction is purely Y
      }
      
      // Alpha fade from tail (old) to head (new) - newer points are more opaque
      const t = i / trail.positions.length;
      const alphaAtStart = t * 0.8;     // Start of this segment
      const alphaAtEnd = (t + 1/trail.positions.length) * 0.8; // End of segment
      
      // Calculate width scaling based on position in trail (fade out at tail)
      const widthScaleStart = Math.max(0.2, t);
      const widthScaleEnd = Math.max(0.2, t + 1/trail.positions.length);
      
      const halfWidthStart = trail.thickness * widthScaleStart / 2;
      const halfWidthEnd = trail.thickness * widthEnd / 2;

      // Generate quad vertices (two triangles)
      // Triangle 1: bottom-left, top-left, top-right
      positions.push(
        p1.x - right.x * halfWidthStart, p1.y, p1.z - right.z * halfWidthStart,
        p1.x + right.x * halfWidthStart, p1.y, p1.z + right.z * halfWidthStart,
        p2.x + right.x * halfWidthEnd,   p2.y, p2.z + right.z * halfWidthEnd
      );
      
      // Triangle 2: bottom-left, top-right, bottom-right  
      positions.push(
        p1.x - right.x * halfWidthStart, p1.y, p1.z - right.z * halfWidthStart,
        p2.x + right.x * halfWidthEnd,   p2.y, p2.z + right.z * halfWidthEnd,
        p2.x - right.x * halfWidthEnd,   p2.y, p2.z - right.z * halfWidthEnd
      );

      // Colors with alpha gradient
      const r = trail.color.r;
      const g = trail.color.g;
      const b = trail.color.b;
      
      colors.push(
        r, g, b, alphaAtStart,  // bottom-left
        r, g, b, alphaAtStart,  // top-left  
        r, g, b, alphaAtEnd,    // top-right
        r, g, b, alphaAtStart,  // bottom-left (again for second triangle)
        r, g, b, alphaAtEnd,    // top-right
        r, g, b, alphaAtEnd     // bottom-right
      );
    }

    // Update buffer attributes
    trail.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    trail.geometry.setAttribute('color', new Float32BufferAttribute(colors, 4));
    
    // Mark as needing update for GPU transfer
    trail.geometry.attributes.position.needsUpdate = true;
    trail.geometry.attributes.color.needsUpdate = true;
    
    // Update index if geometry changed significantly
    const vertexCount = positions.length / 3;
    if (trail.geometry.index === null || trail.geometry.index.count !== vertexCount * 2) {
      const indices = [];
      for (let i = 0; i < vertexCount; i += 3) {
        indices.push(i, i + 1, i + 2);
      }
      trail.geometry.setIndex(indices);
    }
  }

  /**
   * Dispose of a trail's resources
   */
  disposeTrail(trail) {
    if (trail.mesh) {
      if (trail.mesh.geometry) {
        trail.mesh.geometry.dispose();
      }
      if (trail.mesh.material) {
        trail.mesh.material.dispose();
      }
      // Don't remove from scene here - caller handles that
    }
    
    // Clear position history
    trail.positions = [];
  }

  /**
   * Dispose all trails and clean up
   */
  disposeAll(scene) {
    for (const [id, trail] of this.trails.entries()) {
      if (scene && trail.mesh && scene.children.includes(trail.mesh)) {
        scene.remove(trail.mesh);
      }
      this.disposeTrail(trail);
    }
    this.trails.clear();
  }

  /**
   * Set global visibility for all trails
   */
  setVisible(visible) {
    for (const trail of this.trails.values()) {
      if (trail.mesh) {
        trail.mesh.visible = visible;
      }
    }
  }
}
