import * as THREE from 'three';
import { mulberry32 } from '../../shared/math/MathUtils.js';
import { PALETTE } from '../config.js';
import { createDeckGridTexture, createMetalTexture } from './ProceduralTextures.js';

export class EnvironmentRenderer {
  constructor(scene, tracker, materials, renderer) {
    this.scene = scene;
    this.materials = materials;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.pulse = 0;
    this.group = new THREE.Group();
    this.group.name = 'procedural-environment';

    const deckTexture = tracker.track(createDeckGridTexture(renderer));
    materials.deck.map = deckTexture;
    materials.deck.needsUpdate = true;
    const deckGeometry = new THREE.PlaneGeometry(32, 20, 1, 1);
    this.deck = new THREE.Mesh(deckGeometry, materials.deck);
    this.deck.rotation.x = -Math.PI * 0.5;
    this.deck.position.set(0, -9.55, -1.4);
    this.group.add(this.deck);

    const metalTexture = tracker.track(createMetalTexture(renderer));
    materials.backdrop.map = metalTexture;
    materials.backdrop.needsUpdate = true;
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(31, 22), materials.backdrop);
    this.backdrop.position.set(0, 0.2, -5.2);
    this.group.add(this.backdrop);

    this.starCount = 192;
    this.starX = new Float32Array(this.starCount);
    this.starY = new Float32Array(this.starCount);
    this.starZ = new Float32Array(this.starCount);
    this.starPhase = new Float32Array(this.starCount);
    this.stars = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.055, 0),
      materials.star,
      this.starCount,
    );
    this.stars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stars.frustumCulled = false;
    const random = mulberry32(0x5a771e);
    for (let i = 0; i < this.starCount; i += 1) {
      this.starX[i] = (random() - 0.5) * 30;
      this.starY[i] = (random() - 0.42) * 23;
      this.starZ[i] = -1.2 - random() * 3.4;
      this.starPhase[i] = random() * Math.PI * 2;
    }
    this.group.add(this.stars);

    this.railCount = 36;
    this.rails = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      materials.rail,
      this.railCount,
    );
    this.rails.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rails.frustumCulled = false;
    this._layoutRails();
    this.group.add(this.rails);

    scene.add(this.group);
    tracker.track(this.group);
  }

  _layoutRails() {
    let index = 0;
    for (const side of [-1, 1]) {
      for (let segment = 0; segment < 12; segment += 1) {
        this.dummy.position.set(side * 12.25, -8.8 + segment * 1.6, -0.65);
        this.dummy.scale.set(0.06, 0.62, 0.1);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.rails.setMatrixAt(index, this.dummy.matrix);
        this.color.setHex(side < 0 ? PALETTE.cyan : PALETTE.magenta).multiplyScalar(1.5);
        this.rails.setColorAt(index, this.color);
        index += 1;
      }
    }
    for (let segment = 0; segment < 12; segment += 1) {
      this.dummy.position.set(-11 + segment * 2, -9.25, -0.3);
      this.dummy.scale.set(0.78, 0.045, 0.1);
      this.dummy.updateMatrix();
      this.rails.setMatrixAt(index, this.dummy.matrix);
      this.color.setHex(PALETTE.cyan).multiplyScalar(1.2);
      this.rails.setColorAt(index, this.color);
      index += 1;
    }
    this.rails.count = index;
    this.rails.instanceMatrix.needsUpdate = true;
    this.rails.instanceColor.needsUpdate = true;
  }

  triggerPulse(amount = 1) {
    this.pulse = Math.max(this.pulse, amount);
  }

  update(dt, elapsed) {
    this.pulse *= Math.exp(-3.5 * dt);
    this.materials.deck.emissiveIntensity = 0.25 + this.pulse * 0.35;
    for (let i = 0; i < this.starCount; i += 1) {
      const scale = 0.52 + 0.48 * (0.5 + 0.5 * Math.sin(elapsed * 1.4 + this.starPhase[i]));
      this.dummy.position.set(this.starX[i], this.starY[i], this.starZ[i]);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.stars.setMatrixAt(i, this.dummy.matrix);
      this.color.setHex(PALETTE.white).multiplyScalar(0.7 + scale * 0.85);
      this.stars.setColorAt(i, this.color);
    }
    this.stars.instanceMatrix.needsUpdate = true;
    this.stars.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
