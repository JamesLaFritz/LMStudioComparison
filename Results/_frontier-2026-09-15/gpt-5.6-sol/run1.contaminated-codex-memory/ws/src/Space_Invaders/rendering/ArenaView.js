import * as THREE from 'three';
import { SeededRng } from '../../shared/core/SeededRng.js';
import { GAME_CONFIG } from '../config.js';

const STAR_COUNTS = Object.freeze([72, 110, 160]);
const STAR_DEPTHS = Object.freeze([-7, -13, -21]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class ArenaView {
  constructor({ root, assets, rng = new SeededRng(0xa8e6a) }) {
    if (!root?.isObject3D) throw new TypeError('ArenaView requires an Object3D root.');
    this.root = root;
    this.assets = assets;
    this.rng = rng;
    this.detached = false;
    this.threat = 0;
    this.time = 0;
    this.container = new THREE.Group();
    this.container.name = 'procedural-arena';
    root.add(this.container);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.cyan = new THREE.Color(0x35e8ff);
    this.coral = new THREE.Color(0xff405f);
    this.magenta = new THREE.Color(0xff3fcb);
    this.amber = new THREE.Color(0xffb84d);

    this.nebula = new THREE.Mesh(assets.geometries.nebulaPlane, assets.materials.nebula);
    this.nebula.name = 'procedural-nebula';
    this.nebula.position.set(0, 2.5, -22.5);
    this.nebula.scale.set(62, 46, 1);
    this.nebula.renderOrder = -50;
    this.container.add(this.nebula);

    this.deckBacking = new THREE.Mesh(assets.geometries.nebulaPlane, assets.materials.structure);
    this.deckBacking.name = 'defense-deck-backing';
    this.deckBacking.position.set(0, 0, -0.78);
    this.deckBacking.scale.set(24.5, 28.2, 1);
    this.deckBacking.receiveShadow = true;
    this.container.add(this.deckBacking);

    this.deck = this.#createDeck();
    this.structures = this.#createStructures();
    this.starGroups = this.#createStars();
    this.#createLights();
  }

  syncThreat(value, realDelta = 0) {
    this.threat = clamp(Number(value) || 0, 0, 1);
    this.time += clamp(Number(realDelta) || 0, 0, 0.1);
    this.color.copy(this.cyan).lerp(this.coral, this.threat);
    this.rimLight.color.copy(this.color);
    this.rimLight.intensity = 0.82 + this.threat * 0.38;
    this.counterRimLight.color.copy(this.magenta).lerp(this.amber, this.threat * 0.35);
    this.counterRimLight.intensity = 0.82 + this.threat * 0.14;
    this.assets.materials.deck.emissive.copy(this.color).multiplyScalar(0.32);
    this.assets.materials.deck.emissiveIntensity = 0.36 + this.threat * 0.22;
    const pulse = 0.76 + 0.24 * Math.sin(this.time * (2.5 + this.threat * 5));
    for (let index = 0; index < this.deck.count; index += 1) {
      const phase = (index % 11) / 11;
      this.color.copy(this.cyan).lerp(this.coral, clamp(this.threat + phase * 0.12, 0, 1));
      this.color.multiplyScalar(0.55 + pulse * 0.25);
      this.deck.setColorAt(index, this.color);
    }
    if (this.deck.instanceColor) this.deck.instanceColor.needsUpdate = true;
  }

  applyParallax(cameraOffset = {}) {
    const x = Number(cameraOffset.x) || 0;
    const y = Number(cameraOffset.y) || 0;
    for (let index = 0; index < this.starGroups.length; index += 1) {
      const factor = [0.6, 0.35, 0.15][index];
      this.starGroups[index].position.x = -x * factor;
      this.starGroups[index].position.y = -y * factor;
    }
    this.nebula.position.x = -x * 0.08;
    this.nebula.position.y = 2.5 - y * 0.08;
  }

  setQualityTier(tier) {
    const size = tier === 'low' ? 512 : 1024;
    if (this.keyLight.shadow.mapSize.x === size) return;
    this.keyLight.shadow.mapSize.set(size, size);
    if (this.keyLight.shadow.map) {
      this.keyLight.shadow.map.dispose();
      this.keyLight.shadow.map = null;
    }
    this.keyLight.shadow.needsUpdate = true;
  }

  releaseGpuResourcesForContextLoss() {
    // Shadow maps are allocated by WebGLShadowMap and are therefore not part
    // of the scene ResourceTracker. Release the old renderer's map/listener
    // while GL is lost; the next restored render creates a fresh target.
    if (this.keyLight.shadow.map) {
      this.keyLight.shadow.map.dispose();
      this.keyLight.shadow.map = null;
    }
    this.keyLight.shadow.needsUpdate = true;
  }

  markGpuDataDirty() {
    this.deck.instanceMatrix.needsUpdate = true;
    if (this.deck.instanceColor) this.deck.instanceColor.needsUpdate = true;
    this.structures.instanceMatrix.needsUpdate = true;
    for (const stars of this.starGroups) {
      stars.instanceMatrix.needsUpdate = true;
      if (stars.instanceColor) stars.instanceColor.needsUpdate = true;
    }
    this.keyLight.shadow.needsUpdate = true;
  }

  reset() {
    this.time = 0;
    this.syncThreat(0, 0);
    this.applyParallax({ x: 0, y: 0 });
  }

  detach() {
    if (this.detached) return;
    this.container.removeFromParent();
    this.detached = true;
  }

  #createDeck() {
    const verticalCount = 25;
    const horizontalCount = 29;
    const count = verticalCount + horizontalCount;
    const mesh = new THREE.InstancedMesh(this.assets.geometries.deckStrip, this.assets.materials.deck, count);
    mesh.name = 'reactive-defense-grid';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color(0x35e8ff));
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.position.z = -0.7;
    mesh.receiveShadow = true;
    let index = 0;
    for (let column = 0; column < verticalCount; column += 1) {
      this.dummy.position.set(-12 + column, 0, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(0.018, 28, 1);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index++, this.dummy.matrix);
    }
    for (let row = 0; row < horizontalCount; row += 1) {
      this.dummy.position.set(0, -14 + row, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(24, 0.018, 1);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index++, this.dummy.matrix);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    this.container.add(mesh);
    return mesh;
  }

  #createStructures() {
    const count = 28;
    const mesh = new THREE.InstancedMesh(this.assets.geometries.structure, this.assets.materials.structure, count);
    mesh.name = 'distant-orbital-structures';
    for (let index = 0; index < count; index += 1) {
      const side = index & 1 ? 1 : -1;
      const width = this.rng.range(0.18, 0.62);
      const height = this.rng.range(0.5, 2.8);
      this.dummy.position.set(side * this.rng.range(12.7, 18.5), this.rng.range(-14, 15), -3.5 - this.rng.range(0, 3));
      this.dummy.rotation.set(0, 0, this.rng.range(-0.08, 0.08));
      this.dummy.scale.set(width, height, this.rng.range(0.25, 0.8));
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.container.add(mesh);
    return mesh;
  }

  #createStars() {
    const materials = [this.assets.materials.starNear, this.assets.materials.starMid, this.assets.materials.starFar];
    return STAR_COUNTS.map((count, band) => {
      const mesh = new THREE.InstancedMesh(this.assets.geometries.star, materials[band], count);
      mesh.name = `star-depth-band-${band}`;
      mesh.frustumCulled = false;
      mesh.setColorAt(0, new THREE.Color(0xffffff));
      for (let index = 0; index < count; index += 1) {
        const scale = this.rng.range(0.45, band === 0 ? 1.8 : 1.25);
        this.dummy.position.set(this.rng.range(-25, 25), this.rng.range(-31, 31), STAR_DEPTHS[band] + this.rng.range(-1.5, 1.5));
        this.dummy.rotation.set(this.rng.range(0, Math.PI), this.rng.range(0, Math.PI), this.rng.range(0, Math.PI));
        this.dummy.scale.setScalar(scale);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(index, this.dummy.matrix);
        this.color.set(band === 0 ? 0xdffcff : band === 1 ? 0x91cbd8 : 0x756a9d);
        this.color.multiplyScalar(this.rng.range(0.62, 1));
        mesh.setColorAt(index, this.color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.renderOrder = -20 + band;
      this.container.add(mesh);
      return mesh;
    });
  }

  #createLights() {
    this.fillLight = new THREE.HemisphereLight(0x8fd9ff, 0x080514, 0.45);
    this.fillLight.name = 'cool-hemisphere-fill';
    this.container.add(this.fillLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    this.keyLight.name = 'neutral-key-light';
    this.keyLight.position.set(5, 9, 14);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = -13;
    this.keyLight.shadow.camera.right = 13;
    this.keyLight.shadow.camera.top = 15;
    this.keyLight.shadow.camera.bottom = -15;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 45;
    this.keyLight.shadow.bias = -0.0004;
    this.container.add(this.keyLight);
    this.container.add(this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight(0x35e8ff, 0.85);
    this.rimLight.name = 'threat-rim-light';
    this.rimLight.position.set(-8, 4, 9);
    this.rimLight.castShadow = false;
    this.container.add(this.rimLight);

    this.counterRimLight = new THREE.DirectionalLight(0xff3fcb, 0.82);
    this.counterRimLight.name = 'magenta-counter-rim-light';
    this.counterRimLight.position.set(8, -3, 10);
    this.counterRimLight.castShadow = false;
    this.container.add(this.counterRimLight);
  }
}
