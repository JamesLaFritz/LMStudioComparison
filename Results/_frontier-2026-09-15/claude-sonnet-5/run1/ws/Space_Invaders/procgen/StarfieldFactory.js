import * as THREE from 'three';
import { CanvasTextureFactory } from '../../shared/procgen/CanvasTextureFactory.js';

const LAYER_CONFIGS = [
  { count: 400, radius: 60, depthZ: -40, depthSpread: 20, size: 0.35, opacity: 0.9, driftSpeed: 0.4, color: '#bfe9ff' },
  { count: 250, radius: 50, depthZ: -55, depthSpread: 20, size: 0.55, opacity: 0.6, driftSpeed: 0.8, color: '#8fd6ff' },
  { count: 150, radius: 40, depthZ: -70, depthSpread: 20, size: 0.85, opacity: 0.4, driftSpeed: 1.4, color: '#6fb8ff' }
];

/**
 * Three parallax-depth starfield layers built from rejection-sampled uniform
 * disk positions (r = R*sqrt(random) avoids center clustering) and a single
 * shared radial-glow canvas texture as the point sprite.
 */
export const StarfieldFactory = {
  build(scene, disposer) {
    const sharedTexture = CanvasTextureFactory.radialGlow(64, '#ffffff');
    disposer?.trackTexture(sharedTexture);

    const layers = [];

    for (const config of LAYER_CONFIGS) {
      const positions = new Float32Array(config.count * 3);
      for (let i = 0; i < config.count; i++) {
        const r = config.radius * Math.sqrt(Math.random());
        const theta = Math.random() * Math.PI * 2;
        positions[i * 3] = Math.cos(theta) * r;
        positions[i * 3 + 1] = Math.random() * 30 + 2;
        positions[i * 3 + 2] = config.depthZ - Math.random() * config.depthSpread;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      disposer?.trackGeometry(geometry);

      const material = new THREE.PointsMaterial({
        size: config.size,
        map: sharedTexture,
        color: new THREE.Color(config.color),
        transparent: true,
        opacity: config.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      });
      disposer?.trackMaterial(material);

      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      scene.add(points);

      layers.push({ points, driftSpeed: config.driftSpeed });
    }

    let elapsed = 0;

    return {
      layers,
      update(dt) {
        elapsed += dt;
        for (const layer of layers) {
          layer.points.position.x = Math.sin(elapsed * 0.06 * layer.driftSpeed) * 2.5;
        }
      },
      dispose(sceneRef) {
        for (const layer of layers) sceneRef.remove(layer.points);
      }
    };
  }
};
