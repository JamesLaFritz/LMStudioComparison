import * as THREE from 'three';

export class MotionTrailManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.trails = new Map(); // meshId → trailData
    this.thresholdVelocity = 5.0;
    
    // Shared geometry and material for all trails
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    this.trailMesh = new THREE.Line(this.geometry, this.material);
    scene.add(this.trailMesh);
    this.trailMesh.frustumCulled = true;
  }

  addTrail(entity) {
    if (!entity.id || entity.velocity.length() < this.thresholdVelocity) return;
    
    const trailData = {
      positions: [],
      timestamps: [],
      maxSegments: 20,
      entity: entity
    };
    this.trails.set(entity.id, trailData);
  }

  updateTrails(deltaTime) {
    const allPositions = [];
    
    for (const [id, data] of this.trails.entries()) {
      if (!data.entity || !this.scene.getObjectById(data.entity.id)) continue;
      
      const position = data.entity.position.clone();
      data.positions.push(position);
      data.timestamps.push(Date.now());
      
      // Remove old segments based on time (500ms trail duration)
      const now = Date.now();
      while (data.timestamps.length > 0 && now - data.timestamps[0] > 500) {
        data.positions.shift();
        data.timestamps.shift();
      }
      
      // Add positions to render list
      for (const pos of data.positions) {
        allPositions.push(pos);
      }
    }
    
    if (allPositions.length === 0) return;
    
    const positionsArray = allPositions.flatMap(p => [p.x, p.y, p.z]);
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionsArray, 3));
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  removeTrail(entityId) {
    this.trails.delete(entityId);
  }

  dispose() {
    this.scene.remove(this.trailMesh);
    this.geometry.dispose();
    this.material.dispose();
    this.trailMesh = null;
    this.trails.clear();
  }
}