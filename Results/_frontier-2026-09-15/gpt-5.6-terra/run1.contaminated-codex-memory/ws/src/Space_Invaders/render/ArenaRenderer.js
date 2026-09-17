import * as THREE from 'three';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createGridTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#07152b');
  gradient.addColorStop(1, '#02040c');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(27, 231, 255, 0.18)';
  context.lineWidth = 1;
  for (let tick = 0; tick <= canvas.width; tick += 32) {
    context.beginPath();
    context.moveTo(tick, 0);
    context.lineTo(tick, canvas.height);
    context.stroke();
  }
  for (let tick = 0; tick <= canvas.height; tick += 32) {
    context.beginPath();
    context.moveTo(0, tick);
    context.lineTo(canvas.width, tick);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1.25);
  return texture;
}

function disposeMaterial(material) {
  if (!material) return;
  for (const value of Object.values(material)) {
    if (value?.isTexture) value.dispose();
  }
  material.dispose();
}

/** A procedural stage; all visual surfaces use MeshStandardMaterial. */
export class ArenaRenderer {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'space-invaders-arena';
    scene.add(this.group);
    this.time = 0;
    this.materials = [];
    this.geometries = [];

    const gridTexture = createGridTexture();
    const backdropMaterial = this.#material({
      color: 0x061020,
      metalness: 0.82,
      roughness: 0.34,
      map: gridTexture,
      emissive: 0x04162b,
      emissiveMap: gridTexture,
      emissiveIntensity: 0.34,
    });
    const backdrop = new THREE.Mesh(this.#geometry(new THREE.BoxGeometry(31.8, 19.6, 0.38)), backdropMaterial);
    backdrop.position.set(0, 0, -1.25);
    backdrop.receiveShadow = true;
    this.group.add(backdrop);

    const frameMaterial = this.#material({ color: 0x122442, metalness: 0.95, roughness: 0.22, emissive: 0x061321, emissiveIntensity: 0.7 });
    const frameGeometry = this.#geometry(new THREE.BoxGeometry(0.34, 20.1, 0.55));
    for (const x of [-15.85, 15.85]) {
      const pillar = new THREE.Mesh(frameGeometry, frameMaterial);
      pillar.position.set(x, 0, -0.72);
      pillar.castShadow = true;
      this.group.add(pillar);
    }

    const railMaterial = this.#material({ color: 0x1b3850, metalness: 0.9, roughness: 0.2, emissive: 0x00c9e8, emissiveIntensity: 1.25 });
    const rail = new THREE.Mesh(this.#geometry(new THREE.BoxGeometry(30.8, 0.13, 0.42)), railMaterial);
    rail.position.set(0, -9.5, -0.1);
    this.group.add(rail);

    const horizonMaterial = this.#material({ color: 0x11213f, metalness: 0.77, roughness: 0.28, emissive: 0x48277f, emissiveIntensity: 0.48 });
    const horizon = new THREE.Mesh(this.#geometry(new THREE.BoxGeometry(30.5, 0.65, 0.26)), horizonMaterial);
    horizon.position.set(0, 8.95, -0.72);
    this.group.add(horizon);

    this.#addStars();
    this.#addLights();
  }

  #material(options) {
    const material = new THREE.MeshStandardMaterial(options);
    this.materials.push(material);
    return material;
  }

  #geometry(geometry) {
    this.geometries.push(geometry);
    return geometry;
  }

  #addStars() {
    const count = 300;
    const geometry = this.#geometry(new THREE.OctahedronGeometry(0.025, 0));
    const material = this.#material({ color: 0x9beeff, metalness: 0.1, roughness: 0.4, emissive: 0x40b8ff, emissiveIntensity: 1.6 });
    const stars = new THREE.InstancedMesh(geometry, material, count);
    stars.name = 'procedural-starfield';
    stars.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const random = seededRandom(0xa117c0de);
    this.starBase = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const x = (random() - 0.5) * 30;
      const y = (random() - 0.5) * 18.5;
      const z = -0.9 + random() * 0.3;
      this.starBase.set([x, y, z], index * 3);
      const scale = 0.4 + random() * 1.2;
      matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
      stars.setMatrixAt(index, matrix);
      color.setHSL(0.54 + random() * 0.1, 0.85, 0.65 + random() * 0.28);
      stars.setColorAt(index, color);
    }
    stars.instanceMatrix.needsUpdate = true;
    stars.instanceColor.needsUpdate = true;
    this.stars = stars;
    this.group.add(stars);
  }

  #addLights() {
    const ambient = new THREE.HemisphereLight(0x8bc9ff, 0x050812, 1.2);
    const key = new THREE.DirectionalLight(0x7bb8ff, 2.1);
    key.position.set(-5, 8, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const magenta = new THREE.PointLight(0xda31ff, 7, 20, 2);
    magenta.position.set(0, 6, 4);
    const cyan = new THREE.PointLight(0x00ddff, 5, 18, 2);
    cyan.position.set(0, -7, 5);
    this.group.add(ambient, key, magenta, cyan);
  }

  update(realDelta) {
    this.time += realDelta;
    if (!this.stars) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    for (let index = 0; index < this.starBase.length / 3; index += 1) {
      position.set(this.starBase[index * 3], this.starBase[index * 3 + 1], this.starBase[index * 3 + 2]);
      const pulse = 0.6 + 0.4 * Math.sin(this.time * (1.4 + (index % 5) * 0.17) + index);
      scale.setScalar(0.45 + pulse * 0.75);
      matrix.compose(position, rotation, scale);
      this.stars.setMatrixAt(index, matrix);
    }
    this.stars.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) disposeMaterial(material);
    this.geometries.length = 0;
    this.materials.length = 0;
  }
}
