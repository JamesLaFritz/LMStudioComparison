/**
 * MotionTrails — Trail renderer for fast-moving objects using InstancedMesh.
 * Shared across all games.
 */
import * as THREE from 'three';

export class MotionTrails {
  /**
   * @param {THREE.Scene} scene
   * @param {object} [options]
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.maxHistory = options.maxHistory || 20;
    this.trailObjects = new Map(); // objectUUID -> trail data
  }

  /**
   * Attach a trail to a 3D object.
   * @param {THREE.Object3D} target - The object to trail.
   * @param {object} [config]
   */
  attach(target, config = {}) {
    const uuid = target.uuid;
    if (this.trailObjects.has(uuid)) return;

    const size = config.size || 0.1;
    const color = config.color || new THREE.Color(0x00ffff);
    const opacity = config.opacity !== undefined ? config.opacity : 0.6;

    // Create instanced mesh for trail instances
    const geometry = new THREE.SphereGeometry(size, 6, 4);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
    });

    const instancedMesh = new THREE.InstancedMesh(geometry, material, this.maxHistory);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(instancedMesh);

    const history = [];
    const dummy = new THREE.Object3D();

    this.trailObjects.set(uuid, {
      target,
      instancedMesh,
      geometry,
      material,
      history,
      dummy,
      size,
      color: color.clone(),
      opacity,
      visible: true,
    });

    // Hide all instances initially
    for (let i = 0; i < this.maxHistory; i++) {
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Update all trails. Call each frame.
   */
  update() {
    const dummy = new THREE.Object3D();

    for (const [uuid, data] of this.trailObjects) {
      if (!data.visible) continue;

      const { target, instancedMesh, history } = data;

      // Record current position
      const pos = new THREE.Vector3();
      target.getWorldPosition(pos);
      history.push(pos.clone());

      // Trim history
      while (history.length > this.maxHistory) {
        history.shift();
      }

      // Update instances
      for (let i = 0; i < this.maxHistory; i++) {
        if (i < history.length) {
          const age = i / history.length; // 0 = oldest, ~1 = newest
          const scale = age * age * data.size; // Quadratic fade
          dummy.position.copy(history[i]);
          dummy.scale.set(scale, scale, scale);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
        } else {
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
        }
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Set trail visibility for a specific object.
   */
  setVisible(uuid, visible) {
    const data = this.trailObjects.get(uuid);
    if (data) {
      data.visible = visible;
      data.instancedMesh.visible = visible;
    }
  }

  /**
   * Update trail color for a specific object.
   */
  setColor(uuid, color) {
    const data = this.trailObjects.get(uuid);
    if (data) {
      data.material.color.set(color);
    }
  }

  /**
   * Detach and dispose trail for a specific object.
   */
  detach(uuid) {
    const data = this.trailObjects.get(uuid);
    if (!data) return;

    this.scene.remove(data.instancedMesh);
    data.instancedMesh.dispose();
    data.geometry.dispose();
    data.material.dispose();
    data.history.length = 0;
    this.trailObjects.delete(uuid);
  }

  /**
   * Dispose all trails.
   */
  dispose() {
    for (const uuid of this.trailObjects.keys()) {
      this.detach(uuid);
    }
  }
}
