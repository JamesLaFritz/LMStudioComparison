import * as THREE from 'three';
import { randRange } from '../../shared/utils/Math.js';

/**
 * Starfield — 800-point backdrop in two depth layers, slow parallax drift.
 * One THREE.Points per layer (2 draw calls total).
 */
export default class Starfield {
  constructor(scene, { count = 800 } = {}) {
    this.scene = scene;
    this.layers = [];
    const perLayer = Math.floor(count / 2);

    for (let L = 0; L < 2; L++) {
      const depth = L === 0 ? 18 : 30; // farther layer sits deeper
      const size = L === 0 ? 0.05 : 0.035;
      const positions = new Float32Array(perLayer * 3);
      for (let i = 0; i < perLayer; i++) {
        positions[i * 3] = randRange(-30, 30);
        positions[i * 3 + 1] = randRange(-18, 18);
        positions[i * 3 + 2] = -depth + randRange(-2, 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: L === 0 ? 0x9fd8ff : 0x5577aa,
        size,
        sizeAttenuation: true,
        transparent: true,
        opacity: L === 0 ? 0.9 : 0.55,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      scene.add(points);
      this.layers.push({ points, drift: L === 0 ? 0.12 : 0.05 });
    }
    this._t = 0;
  }

  update(dt) {
    this._t += dt;
    for (const L of this.layers) {
      // Slow vertical drift + subtle horizontal sway (layered sine).
      L.points.position.y = Math.sin(this._t * 0.05 + L.drift * 10) * 0.4;
      L.points.position.x = Math.sin(this._t * 0.03 + L.drift * 20) * 0.6;
    }
  }

  dispose() {
    for (const L of this.layers) {
      this.scene.remove(L.points);
      L.points.geometry.dispose();
      L.points.material.dispose();
    }
  }
}
