// Space_Invaders/vfx/Starfield.js
// Procedural deep-space backdrop: a layered THREE.Points starfield with
// slow parallax drift + a faint nebula gradient plane. 100% generated —
// no textures, no files. One draw call for the stars.

import * as THREE from 'three';
import { SimplexNoise } from '../../shared/math/SimplexNoise.js';

const STAR_COUNT = 1600;

export class Starfield {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;

    // ── Stars: position buffer + per-star color (white → cyan → violet) ──
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const cWhite = new THREE.Color(0xeaf6ff);
    const cCyan = new THREE.Color(0x7df9ff);
    const cViolet = new THREE.Color(0x9a7dff);
    const tmp = new THREE.Color();

    for (let i = 0; i < STAR_COUNT; i++) {
      // Distribute in a wide slab behind the playfield (z from -30 to -8).
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = -8 - Math.random() * 22;

      const pick = Math.random();
      if (pick < 0.7) tmp.copy(cWhite);
      else if (pick < 0.9) tmp.copy(cCyan);
      else tmp.copy(cViolet);
      const dim = 0.35 + Math.random() * 0.65;
      colors[i * 3] = tmp.r * dim;
      colors[i * 3 + 1] = tmp.g * dim;
      colors[i * 3 + 2] = tmp.b * dim;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // ── Nebula: a large plane with a procedural radial-gradient CanvasTexture ──
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    g.addColorStop(0.0, 'rgba(64, 32, 128, 0.55)');
    g.addColorStop(0.35, 'rgba(20, 40, 96, 0.35)');
    g.addColorStop(0.7, 'rgba(8, 12, 32, 0.12)');
    g.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    // Second, offset cyan bloom for depth.
    const g2 = ctx.createRadialGradient(150, 330, 10, 150, 330, 200);
    g2.addColorStop(0.0, 'rgba(0, 120, 160, 0.28)');
    g2.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, 512, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const nebulaMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.8,
    });
    const nebulaGeo = new THREE.PlaneGeometry(70, 46);
    this.nebula = new THREE.Mesh(nebulaGeo, nebulaMat);
    this.nebula.position.set(0, 0, -26);
    scene.add(this.nebula);

    this._geometry = geometry;
    this._material = material;
    this._nebulaGeo = nebulaGeo;
    this._nebulaMat = nebulaMat;
    this._nebulaTex = texture;
    this._noise = new SimplexNoise(777);
    this._t = 0;
  }

  /** Slow parallax drift + subtle twinkle via opacity pulse. */
  update(dt, elapsed) {
    this._t += dt;
    // Drift the whole starfield slowly downward-left (space is moving).
    this.points.rotation.z = Math.sin(elapsed * 0.02) * 0.02;
    this.points.position.y = Math.sin(elapsed * 0.05) * 0.15;
    // Twinkle: gentle global opacity breathing (cheap, no per-star work).
    this._material.opacity = 0.75 + Math.sin(elapsed * 0.8) * 0.12;
    // Nebula slow rotation for life.
    this.nebula.rotation.z = elapsed * 0.004;
  }

  dispose() {
    if (this.points.parent) this.points.parent.remove(this.points);
    if (this.nebula.parent) this.nebula.parent.remove(this.nebula);
    this._geometry.dispose();
    this._material.dispose();
    this._nebulaGeo.dispose();
    this._nebulaMat.dispose();
    this._nebulaTex.dispose();
  }
}
