import * as THREE from 'three';

function standard(options) {
  return new THREE.MeshStandardMaterial(options);
}

export class PlayerRenderer {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'player-interceptor';
    this.materials = [];
    this.geometries = [];
    const hull = this.#mesh(new THREE.BoxGeometry(1.65, 0.38, 0.48), { color: 0x1b4e75, metalness: 0.9, roughness: 0.2 });
    const nose = this.#mesh(new THREE.ConeGeometry(0.42, 0.9, 4), { color: 0x3aaef5, metalness: 0.82, roughness: 0.18 });
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 1.1;
    const canopy = this.#mesh(new THREE.SphereGeometry(0.33, 12, 8), { color: 0x86f7ff, metalness: 0.15, roughness: 0.08, emissive: 0x0bb9d2, emissiveIntensity: 1.3, transparent: true, opacity: 0.85 });
    canopy.scale.set(1.25, 0.7, 0.85);
    canopy.position.set(-0.08, 0.27, 0.08);
    this.engineMaterial = standard({ color: 0x45dfff, metalness: 0.2, roughness: 0.3, emissive: 0x00d5ff, emissiveIntensity: 2.2 });
    this.materials.push(this.engineMaterial);
    const engineGeometry = new THREE.CylinderGeometry(0.13, 0.22, 0.44, 10);
    this.geometries.push(engineGeometry);
    const engine = new THREE.Mesh(engineGeometry, this.engineMaterial);
    engine.rotation.z = Math.PI / 2;
    engine.position.x = -1.0;
    this.group.add(hull, nose, canopy, engine);
    this.group.visible = false;
    scene.add(this.group);
    this.time = 0;
  }

  #mesh(geometry, options) {
    const material = standard(options);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.geometries.push(geometry);
    this.materials.push(material);
    return mesh;
  }

  sync(player = {}) {
    this.group.visible = Boolean(player.alive);
    if (!player.alive) return;
    this.group.position.set(player.x ?? 0, player.y ?? -9, player.z ?? 0.22);
    this.group.rotation.z = THREE.MathUtils.clamp(-(player.vx ?? 0) * 0.025, -0.23, 0.23);
  }

  update(realDelta) {
    this.time += realDelta;
    this.engineMaterial.emissiveIntensity = 1.8 + Math.sin(this.time * 20) * 0.55;
  }

  dispose() {
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
