import * as THREE from 'three';

const MAX_INVADERS = 50;
const MAX_UFOS = 2;

interface InvaderGeometrySet {
  geo: THREE.BufferGeometry;
  mat: THREE.MeshStandardMaterial;
}

function createInvaderGeometry(type: number): InvaderGeometrySet {
  let geometry: THREE.BufferGeometry;
  const colors = [0x00ff88, 0x00ccff, 0xff66aa];
  const emissives = [0x00ff88, 0x00ccff, 0xff66aa];

  switch (type) {
    case 0: // Top row - Icosahedron
      geometry = new THREE.IcosahedronGeometry(0.25, 0);
      break;
    case 1: // Middle rows - Octahedron
      geometry = new THREE.OctahedronGeometry(0.25, 0);
      break;
    default: // Bottom rows - Dodecahedron
      geometry = new THREE.DodecahedronGeometry(0.25, 0);
      break;
  }

  const material = new THREE.MeshStandardMaterial({
    color: colors[type] || 0x00ff88,
    emissive: emissives[type] || 0x00ff88,
    emissiveIntensity: 1.5,
    roughness: 0.3,
    metalness: 0.7,
  });

  return { geo: geometry, mat: material };
}

function createPlayerGroup(): THREE.Group {
  const group = new THREE.Group();

  // Main body - wedge shape using merged boxes
  const bodyGeo = new THREE.BoxGeometry(0.5, 0.15, 0.3);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x004466,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.8,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);

  // Cannon
  const cannonGeo = new THREE.BoxGeometry(0.06, 0.06, 0.25);
  const cannon = new THREE.Mesh(cannonGeo, bodyMat.clone());
  cannon.position.z = -0.2;
  cannon.position.y = 0.04;

  // Wings
  const wingGeo = new THREE.BoxGeometry(0.15, 0.08, 0.15);
  const leftWing = new THREE.Mesh(wingGeo, bodyMat.clone());
  leftWing.position.set(-0.3, -0.04, 0.05);
  const rightWing = new THREE.Mesh(wingGeo, bodyMat.clone());
  rightWing.position.set(0.3, -0.04, 0.05);

  group.add(body);
  group.add(cannon);
  group.add(leftWing);
  group.add(rightWing);

  return group;
}

function createUFOMesh(): THREE.Mesh {
  const geometry = new THREE.TorusGeometry(0.2, 0.08, 8, 16);
  const material = new THREE.MeshStandardMaterial({
    color: 0xff00ff,
    emissive: 0xff00ff,
    emissiveIntensity: 3.0,
    transparent: true,
    opacity: 0.9,
    roughness: 0.1,
    metalness: 0.9,
  });
  return new THREE.Mesh(geometry, material);
}

export class EntityPool {
  private invaderGeometries: Map<number, InvaderGeometrySet> = new Map();
  private playerGroupTemplate: THREE.Group | null = null;
  private ufoMeshes: THREE.Mesh[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Pre-create geometry sets for each invader type
    for (let t = 0; t < 3; t++) {
      const set = createInvaderGeometry(t);
      this.invaderGeometries.set(t, set);
    }
    // Pre-create player group template
    this.playerGroupTemplate = createPlayerGroup();
    // Pre-create UFO meshes for pooling
    for (let i = 0; i < MAX_UFOS; i++) {
      const ufo = createUFOMesh();
      ufo.visible = false;
      this.ufoMeshes.push(ufo);
      scene.add(ufo);
    }
  }

  acquireInvader(type: number, position: THREE.Vector3): THREE.Mesh | null {
    const geoSet = this.invaderGeometries.get(type);
    if (!geoSet) return null;

    // Clone material so each invader can have unique emissive animation
    const mat = geoSet.mat.clone();
    const mesh = new THREE.Mesh(geoSet.geo.clone(), mat);
    mesh.position.copy(position);
    mesh.visible = true;
    this.scene.add(mesh);
    return mesh;
  }

  acquirePlayer(): THREE.Group | null {
    if (!this.playerGroupTemplate) return null;
    const clone = this.playerGroupTemplate.clone(true);
    clone.visible = true;
    this.scene.add(clone);
    return clone;
  }

  acquireUFO(position: THREE.Vector3): THREE.Mesh | null {
    for (const ufo of this.ufoMeshes) {
      if (!ufo.userData.active) {
        ufo.position.copy(position);
        ufo.visible = true;
        ufo.userData.active = true;
        return ufo;
      }
    }
    return null;
  }

  releaseInvader(mesh: THREE.Mesh): void {
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) (mesh.material as THREE.Material).dispose();
    this.scene.remove(mesh);
    mesh.userData.active = false;
  }

  releasePlayer(group: THREE.Group): void {
    group.traverse((child) => {
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      if ((child as THREE.Mesh).material) (child as THREE.Mesh).material.dispose();
    });
    this.scene.remove(group);
  }

  releaseUFO(mesh: THREE.Mesh): void {
    mesh.visible = false;
    mesh.userData.active = false;
  }

  dispose(): void {
    for (const geoSet of this.invaderGeometries.values()) {
      geoSet.geo.dispose();
      geoSet.mat.dispose();
    }
    if (this.playerGroupTemplate) {
      this.playerGroupTemplate.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        if ((child as THREE.Mesh).material) (child as THREE.Mesh).material.dispose();
      });
    }
    for (const ufo of this.ufoMeshes) {
      ufo.geometry.dispose();
      ufo.material.dispose();
      this.scene.remove(ufo);
    }
  }
}
