import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createBunkerGeometry } from './GeometryFactory.js';

export class DefenseRenderer {
  constructor(scene, tracker, material) {
    this.scene = scene;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.mesh = new THREE.InstancedMesh(createBunkerGeometry(), material, CONFIG.bunker.capacity);
    this.mesh.name = 'bunker-voxels';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    tracker.track(this.mesh);
  }

  update(simulation, elapsed) {
    let packed = 0;
    for (let id = 0; id < simulation.bunkers.capacity; id += 1) {
      if (simulation.bunkers.alive[id] === 0) continue;
      this.dummy.position.set(simulation.bunkers.x[id], simulation.bunkers.y[id], -0.02);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(packed, this.dummy.matrix);
      const shimmer = 0.82 + 0.18 * Math.sin(elapsed * 1.7 + id * 0.21);
      this.color.setHex(0x43e8d8).multiplyScalar(shimmer);
      this.mesh.setColorAt(packed, this.color);
      packed += 1;
    }
    this.mesh.count = packed;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
  }
}
