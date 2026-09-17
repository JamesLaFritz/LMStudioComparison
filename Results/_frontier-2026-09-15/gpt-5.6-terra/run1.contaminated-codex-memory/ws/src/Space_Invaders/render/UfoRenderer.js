import * as THREE from 'three';

export class UfoRenderer {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'mystery-ufo';
    this.geometries = [];
    this.materials = [];
    const domeMaterial = this.#material({ color: 0xff6eea, metalness: 0.4, roughness: 0.12, emissive: 0xff1094, emissiveIntensity: 1.8 });
    const hullMaterial = this.#material({ color: 0x5a1e71, metalness: 0.9, roughness: 0.18, emissive: 0x3c054b, emissiveIntensity: 0.75 });
    const hull = new THREE.Mesh(this.#geometry(new THREE.SphereGeometry(0.78, 20, 10)), hullMaterial);
    hull.scale.set(1.75, 0.38, 0.8);
    const dome = new THREE.Mesh(this.#geometry(new THREE.SphereGeometry(0.36, 16, 10)), domeMaterial);
    dome.scale.set(1.15, 0.55, 0.8);
    dome.position.y = 0.18;
    this.group.add(hull, dome);
    this.group.visible = false;
    scene.add(this.group);
    this.time = 0;
    this.domeMaterial = domeMaterial;
  }

  #geometry(geometry) {
    this.geometries.push(geometry);
    return geometry;
  }

  #material(options) {
    const material = new THREE.MeshStandardMaterial(options);
    this.materials.push(material);
    return material;
  }

  sync(ufo = {}) {
    this.group.visible = Boolean(ufo.active);
    if (!ufo.active) return;
    this.group.position.set(ufo.x ?? 0, ufo.y ?? 8, ufo.z ?? 0.2);
  }

  update(realDelta) {
    this.time += realDelta;
    this.group.rotation.z = Math.sin(this.time * 3) * 0.05;
    this.domeMaterial.emissiveIntensity = 1.5 + Math.sin(this.time * 12) * 0.65;
  }

  dispose() {
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
