import * as THREE from 'three';

const TRAIL_LENGTH = 12;

export class MotionTrail {
  constructor(scene, color = 0x00ffff, trailLength = TRAIL_LENGTH) {
    this.scene = scene;
    this.trailLength = trailLength;
    this.positions = [];
    this.segments = [];

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    for (let i = 0; i < trailLength; i++) {
      const scale = 1.0 - (i / trailLength);
      const geo = new THREE.SphereGeometry(0.18 * scale, 8, 8);
      const mat = baseMaterial.clone();
      mat.opacity = 0.6 * scale;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = -1;
      scene.add(mesh);
      this.segments.push(mesh);
    }
  }

  update(targetPosition, deltaTime) {
    this.positions.unshift(targetPosition.clone());
    if (this.positions.length > this.trailLength) {
      this.positions.pop();
    }

    for (let i = 0; i < this.trailLength; i++) {
      const seg = this.segments[i];
      if (i < this.positions.length) {
        seg.position.copy(this.positions[i]);
        seg.visible = true;
      } else {
        seg.visible = false;
      }
    }
  }

  dispose() {
    for (const seg of this.segments) {
      seg.geometry.dispose();
      seg.material.dispose();
      this.scene.remove(seg);
    }
    this.segments.length = 0;
    this.positions.length = 0;
  }
}
