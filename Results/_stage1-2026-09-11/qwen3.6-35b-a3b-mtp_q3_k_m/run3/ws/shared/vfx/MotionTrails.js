import * as THREE from 'three';

export class MotionTrails {
  constructor(scene) {
    this.scene = scene;
    this.trackedObjects = new Map();
    this.trailLines = null;
    this.maxTrailPoints = 800; // 100 objects × 8 segments each
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxTrailPoints * 3);
    this.colors = new Float32Array(this.maxTrailPoints * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });

    this.trailLines = new THREE.LineSegments(this.geometry, material);
    this.trailLines.frustumCulled = false;
    this.scene.add(this.trailLines);
    this.activeSegmentCount = 0;
  }

  addTrackedObject(id, color, trailLength = 8) {
    if (this.trackedObjects.has(id)) return;
    const positions = [];
    for (let i = 0; i < trailLength; i++) {
      positions.push(new THREE.Vector3(0, -1000, 0)); // hidden initially
    }
    this.trackedObjects.set(id, { positions, color: new THREE.Color(color), trailLength });
  }

  updatePosition(id, position) {
    const obj = this.trackedObjects.get(id);
    if (!obj) return;
    for (let i = obj.positions.length - 1; i > 0; i--) {
      obj.positions[i].copy(obj.positions[i - 1]);
    }
    obj.positions[0].copy(position);
  }

  removeTrackedObject(id) {
    this.trackedObjects.delete(id);
  }

  render() {
    let segIdx = 0;
    for (const [id, data] of this.trackedObjects) {
      const { positions, color, trailLength } = data;
      for (let i = 0; i < trailLength - 1 && segIdx + 1 < this.maxTrailPoints; i++) {
        const p1 = positions[i];
        const p2 = positions[i + 1];

        const idx = segIdx * 3;
        this.positions[idx] = p1.x;
        this.positions[idx + 1] = p1.y;
        this.positions[idx + 2] = p1.z;

        this.positions[idx + 3] = p2.x;
        this.positions[idx + 4] = p2.y;
        this.positions[idx + 5] = p2.z;

        const t = i / (trailLength - 1);
        const alpha = 1.0 - t * 0.8; // fade from 1.0 to 0.2
        const r = color.r * alpha;
        const g = color.g * alpha;
        const b = color.b * alpha;

        this.colors[idx] = r;
        this.colors[idx + 1] = g;
        this.colors[idx + 2] = b;

        this.colors[idx + 3] = r;
        this.colors[idx + 4] = g;
        this.colors[idx + 5] = b;

        segIdx++;
      }
    }

    this.activeSegmentCount = segIdx;
    if (segIdx === 0) {
      this.trailLines.visible = false;
    } else {
      this.trailLines.visible = true;
      this.geometry.setDrawRange(0, segIdx * 2);
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    }
  }

  dispose() {
    for (const data of this.trackedObjects.values()) {
      for (const pos of data.positions) {
        pos.dispose && pos.dispose(); // Vector3 doesn't have dispose, but safe to call
      }
    }
    this.trackedObjects.clear();
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.trailLines) {
      this.trailLines.material.dispose();
      this.scene.remove(this.trailLines);
    }
  }
}
