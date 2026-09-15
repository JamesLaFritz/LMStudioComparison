import * as THREE from 'three';
import { makeGlowSprite, makeNebulaTexture } from '../../shared/textures/ProceduralTextures.js';
import { COLORS } from '../config.js';

/**
 * Starfield — three parallax star layers (THREE.Points) + a large nebula
 * backdrop plane. Slow drift + per-layer twinkle sell the depth. All
 * resources are registered for disposal.
 */
export default class Starfield {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../shared/core/MemoryRegistry.js').MemoryRegistry} registry
   */
  constructor(scene, registry) {
    this.scene = scene;
    this.registry = registry;
    this.layers = [];

    // One soft glow sprite per point (PointsMaterial.map applies the whole
    // texture to every point, so a per-star tile would render the entire
    // starfield on each point — a single radial sprite is the correct map).
    const starTex = makeGlowSprite(128, 'rgba(255,255,255,1)');
    registry.track(starTex);

    const layerDefs = [
      { count: 220, size: 0.10, z: -30, color: COLORS.star1, speed: 0.15 },
      { count: 140, size: 0.16, z: -22, color: COLORS.star2, speed: 0.30 },
      { count: 80,  size: 0.24, z: -16, color: COLORS.star3, speed: 0.55 },
    ];

    for (const def of layerDefs) {
      const positions = new Float32Array(def.count * 3);
      for (let i = 0; i < def.count; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * 90;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 2] = def.z + (Math.random() - 0.5) * 4;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      registry.track(geo);

      const mat = new THREE.PointsMaterial({
        size: def.size,
        map: starTex,
        color: def.color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      registry.track(mat);

      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      scene.add(points);
      this.layers.push({ points, mat, speed: def.speed, baseOpacity: 0.9 });
    }

    // Nebula backdrop — a large plane far behind, slowly rotating.
    const nebTex = makeNebulaTexture(512, 7);
    registry.track(nebTex);
    const nebGeo = new THREE.PlaneGeometry(120, 80);
    const nebMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveIntensity: 0.5,
      emissiveMap: nebTex,
      map: nebTex,
      transparent: true,
      depthWrite: false,
    });
    registry.track(nebGeo);
    registry.track(nebMat);
    const nebula = new THREE.Mesh(nebGeo, nebMat);
    nebula.position.set(0, 0, -45);
    scene.add(nebula);
    this.nebula = nebula;
  }

  /** Slow drift + twinkle. */
  update(dt, time) {
    for (const l of this.layers) {
      l.points.position.x = Math.sin(time * 0.02) * l.speed * 2;
      l.points.position.y = Math.cos(time * 0.015) * l.speed;
      // twinkle
      l.mat.opacity = l.baseOpacity * (0.85 + Math.sin(time * 1.5 + l.speed * 10) * 0.15);
    }
    if (this.nebula) {
      this.nebula.rotation.z = Math.sin(time * 0.01) * 0.05;
      this.nebula.material.emissiveIntensity = 0.45 + Math.sin(time * 0.2) * 0.08;
    }
  }

  dispose() {
    // geometries / materials / textures disposed via registry.disposeAll()
  }
}
