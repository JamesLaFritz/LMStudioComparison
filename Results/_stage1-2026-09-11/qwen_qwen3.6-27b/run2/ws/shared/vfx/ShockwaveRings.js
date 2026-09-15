import * as THREE from 'three';
import { clamp } from 'shared/math/MathUtils.js';
import { MemoryTracker } from 'shared/memory/MemoryTracker.js';

const tracker = new MemoryTracker();

export class ShockwaveRings {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
  }

  emit(position, maxRadius, color, duration) {
    const radius = 0.05;
    const tube = 0.03;
    const radialSegments = 8;
    const tubularSegments = 32;
    const geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
    tracker.trackGeometry(geometry);
    const material = new THREE.MeshStandardMaterial({
      color: color || 0xffffff,
      emissive: color || 0xffffff,
      emissiveIntensity: 3,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    tracker.trackMaterial(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.x = Math.PI / 2;
    this.scene.add(mesh);
    this.rings.push({
      mesh,
      birth: performance.now(),
      duration: (duration || 600) / 1000,
      maxRadius: maxRadius || 2,
      disposed: false,
    });
  }

  update(dt) {
    const now = performance.now();
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      if (ring.disposed) { this.rings.splice(i, 1); continue; }
      const age = (now - ring.birth) / 1000;
      const t = clamp(age / ring.duration, 0, 1);
      const scale = 1 + t * ring.maxRadius * 15;
      ring.mesh.scale.set(scale, scale, 1);
      ring.mesh.material.opacity = 1 - t;
      ring.mesh.material.emissiveIntensity = 3 * (1 - t);
      if (t >= 1) {
        this.scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  clear() {
    for (const ring of this.rings) {
      if (!ring.disposed) {
        this.scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
        ring.disposed = true;
      }
    }
    this.rings.length = 0;
  }
}
