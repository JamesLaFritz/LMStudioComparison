import * as THREE from 'three';

/**
 * Shared PBR lighting presets for all games.
 * Creates a consistent retro-futuristic lighting environment.
 */
export class LightingSetup {
  static init(scene) {
    const lights = [];

    // Hemisphere light for ambient fill (purple sky, dark blue ground)
    const hemi = new THREE.HemisphereLight(0x1a0033, 0x0a0a2e, 0.4);
    scene.add(hemi);
    lights.push(hemi);

    // Directional key light
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    lights.push(dir);

    // Subtle rim/back light
    const rim = new THREE.DirectionalLight(0x4400aa, 0.3);
    rim.position.set(-5, 3, -5);
    scene.add(rim);
    lights.push(rim);

    return lights;
  }

  /**
   * Add a dynamic point light to the scene (e.g., for ball glow).
   */
  static addPointLight(scene, color, intensity, distance, position) {
    const light = new THREE.PointLight(color, intensity, distance);
    if (position) light.position.copy(position);
    scene.add(light);
    return light;
  }

  /**
   * Dispose all lights created by this setup.
   */
  static dispose(lights) {
    if (!lights) return;
    for (const light of lights) {
      light.dispose && light.dispose();
    }
  }
}
