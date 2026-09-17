import * as THREE from 'three';
import { createDeckTexture, createNebulaTexture } from '@shared/procedural/CanvasTextureFactory.js';

export class EnvironmentRenderer {
  constructor(parent, registry) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.deckTexture = createDeckTexture();
    this.nebulaTextureA = createNebulaTexture(0x91c6a4d3);
    this.nebulaTextureB = createNebulaTexture(0x4ad19ef2);
    this.nebulaTextureA.repeat.set(1.8, 1.2);
    this.nebulaTextureB.repeat.set(1.35, 1.1);

    this.deckMaterial = new THREE.MeshStandardMaterial({
      color: 0x132b47,
      map: this.deckTexture,
      emissive: new THREE.Color(0x123e4c),
      emissiveMap: this.deckTexture,
      emissiveIntensity: 0.24,
      metalness: 0.72,
      roughness: 0.31,
    });
    this.nebulaMaterialA = new THREE.MeshStandardMaterial({
      color: 0x274d94,
      map: this.nebulaTextureA,
      emissive: new THREE.Color(0x193a91),
      emissiveMap: this.nebulaTextureA,
      emissiveIntensity: 0.46,
      metalness: 0.02,
      roughness: 0.9,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    this.nebulaMaterialB = new THREE.MeshStandardMaterial({
      color: 0x6b235f,
      map: this.nebulaTextureB,
      emissive: new THREE.Color(0x7d1b77),
      emissiveMap: this.nebulaTextureB,
      emissiveIntensity: 0.38,
      metalness: 0.02,
      roughness: 0.9,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });

    const deckGeometry = new THREE.BoxGeometry(26, 2.35, 0.45);
    this.deck = new THREE.Mesh(deckGeometry, this.deckMaterial);
    this.deck.position.set(0, -6.95, -0.75);
    this.root.add(this.deck);

    const nebulaGeometry = new THREE.PlaneGeometry(27, 17);
    this.nebulaA = new THREE.Mesh(nebulaGeometry, this.nebulaMaterialA);
    this.nebulaA.position.set(-1.5, 1.2, -6.4);
    this.nebulaB = new THREE.Mesh(nebulaGeometry, this.nebulaMaterialB);
    this.nebulaB.position.set(2.4, 0.1, -5.8);
    this.root.add(this.nebulaA, this.nebulaB);

    this.starGeometry = new THREE.IcosahedronGeometry(0.035, 0);
    this.starMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.25,
      metalness: 0,
      roughness: 0.35,
      vertexColors: true,
    });
    this.stars = new THREE.InstancedMesh(this.starGeometry, this.starMaterial, 320);
    this.stars.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const color = new THREE.Color();
    let seed = 0x12c0ffee;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 0x100000000;
    };
    for (let index = 0; index < 320; index += 1) {
      position.set((random() - 0.5) * 27, (random() - 0.35) * 17, -2.5 - random() * 6);
      const size = 0.45 + random() * 1.8;
      scale.set(size, size, size);
      matrix.compose(position, quaternion, scale);
      this.stars.setMatrixAt(index, matrix);
      color.setHSL(0.52 + random() * 0.18, 0.55, 0.7 + random() * 0.25);
      this.stars.setColorAt(index, color);
    }
    this.stars.instanceMatrix.needsUpdate = true;
    this.stars.instanceColor.needsUpdate = true;
    this.root.add(this.stars);

    const pylonGeometry = new THREE.BoxGeometry(0.36, 2.1, 0.36);
    this.pylonMaterial = new THREE.MeshStandardMaterial({
      color: 0x233b5d,
      emissive: 0x12475f,
      emissiveIntensity: 0.7,
      metalness: 0.83,
      roughness: 0.25,
    });
    this.pylons = new THREE.InstancedMesh(pylonGeometry, this.pylonMaterial, 8);
    for (let index = 0; index < 8; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      position.set(side * (10.7 - row * 0.35), -5.55 + row * 1.35, -0.3);
      scale.set(1, 0.72 + row * 0.12, 1);
      matrix.compose(position, quaternion, scale);
      this.pylons.setMatrixAt(index, matrix);
    }
    this.pylons.instanceMatrix.needsUpdate = true;
    this.root.add(this.pylons);

    registry.add(() => this.dispose());
  }

  update(elapsed) {
    this.nebulaA.rotation.z = Math.sin(elapsed * 0.035) * 0.035;
    this.nebulaB.rotation.z = -Math.cos(elapsed * 0.027) * 0.028;
    this.deckMaterial.emissiveIntensity = 0.22 + Math.sin(elapsed * 1.3) * 0.025;
  }

  dispose() {
    this.root.removeFromParent();
    this.deckTexture.dispose();
    this.nebulaTextureA.dispose();
    this.nebulaTextureB.dispose();
    this.deck.geometry.dispose();
    this.nebulaA.geometry.dispose();
    this.starGeometry.dispose();
    this.pylons.geometry.dispose();
    this.deckMaterial.dispose();
    this.nebulaMaterialA.dispose();
    this.nebulaMaterialB.dispose();
    this.starMaterial.dispose();
    this.pylonMaterial.dispose();
  }
}
