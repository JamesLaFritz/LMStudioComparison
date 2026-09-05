import * as THREE from 'three';
import * as C from '../utils/Constants.js';

export class UFOVisuals {
  constructor(scene) {
    this.group = new THREE.Group();
    this.mesh = null;
    this.light = null;
    this.active = false;
    this.timeOffset = Math.random() * Math.PI * 2;

    const ufoColor = C.UFO_COLOR;
    const domeGeo = new THREE.SphereGeometry(0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: ufoColor,
      emissive: ufoColor,
      emissiveIntensity: 2.0,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0;

    // Body (cylinder)
    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.2, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x888899,
      emissive: ufoColor,
      emissiveIntensity: 0.3,
      metalness: 0.9,
      roughness: 0.15,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = -0.1;

    // Bottom ring
    const ringGeo = new THREE.TorusGeometry(0.6, 0.04, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: ufoColor,
      emissive: ufoColor,
      emissiveIntensity: 3.0,
      metalness: 1.0,
      roughness: 0.0,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.2;

    // Emissive strip lights around body
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const lightGeo = new THREE.SphereGeometry(0.04, 8, 8);
      const lightMat = new THREE.MeshStandardMaterial({
        color: ufoColor,
        emissive: ufoColor,
        emissiveIntensity: 4.0,
      });
      const lightMesh = new THREE.Mesh(lightGeo, lightMat);
      lightMesh.position.set(
        Math.cos(angle) * 0.52,
        -0.1,
        Math.sin(angle) * 0.52
      );
      this.group.add(lightMesh);
    }

    this.group.add(dome);
    this.group.add(body);
    this.group.add(ring);

    // Pulsing point light
    this.light = new THREE.PointLight(ufoColor, 3.0, 8);
    this.light.position.y = -0.3;
    this.group.add(this.light);

    scene.add(this.group);
  }

  init() {
    this.group.visible = false;
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }

  setPulse(value) {
    if (this.light) {
      this.light.intensity = value * 5.0;
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  update(ufoData, dt) {
    if (!ufoData.active) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    const t = performance.now() * 0.001 + this.timeOffset;

    // Position from simulation data
    this.group.position.set(ufoData.x, ufoData.y, C.ENEMY_BULLET_Z);

    // Pulsing emissive
    const pulse = 0.5 + 0.5 * Math.sin(t * 8);
    this.light.intensity = 2.0 + pulse * 3.0;

    // Subtle bobbing
    this.group.position.y += Math.sin(t * 3) * 0.05;
  }

  dispose() {
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
