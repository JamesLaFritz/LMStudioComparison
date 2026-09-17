import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BLUEPRINTS = [
  ['001100', '011110', '111111', '101101', '001001'],
  ['011110', '111111', '101101', '111111', '010010'],
  ['001100', '011110', '111111', '010010', '101101'],
];
const COLORS = [0xff4d7d, 0x9d5cff, 0x3bf4d1];

function createVoxelHull(rows, cell = 0.19, depth = 0.24) {
  const boxes = [];
  const width = rows[0].length;
  const height = rows.length;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (rows[row][column] !== '1') continue;
      const box = new THREE.BoxGeometry(cell * 0.94, cell * 0.94, depth);
      box.translate((column - (width - 1) / 2) * cell, ((height - 1) / 2 - row) * cell, 0);
      boxes.push(box);
    }
  }
  const merged = mergeGeometries(boxes, false);
  for (const box of boxes) box.dispose();
  merged.computeVertexNormals();
  return merged;
}

function hidden(matrix) {
  matrix.makeScale(0, 0, 0);
}

/** Instanced, species-separated visual adapter for the 55 simulation slots. */
export class InvaderField {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'invader-field';
    this.meshes = [];
    this.materials = [];
    this.geometries = [];
    this.time = 0;
    const matrix = new THREE.Matrix4();
    for (let type = 0; type < BLUEPRINTS.length; type += 1) {
      const geometry = createVoxelHull(BLUEPRINTS[type]);
      const material = new THREE.MeshStandardMaterial({
        color: COLORS[type],
        metalness: 0.78,
        roughness: 0.23,
        emissive: COLORS[type],
        emissiveIntensity: 1.05,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, 55);
      mesh.frustumCulled = false;
      mesh.name = `invader-species-${type}`;
      for (let index = 0; index < 55; index += 1) {
        hidden(matrix);
        mesh.setMatrixAt(index, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.geometries.push(geometry);
      this.materials.push(material);
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    scene.add(this.group);
  }

  sync(invaders = []) {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    const quaternion = new THREE.Quaternion();
    const cursors = [0, 0, 0];
    for (const invader of invaders) {
      if (!invader?.alive && !invader?.active) continue;
      const rawType = invader.type ?? invader.species ?? (Number.isFinite(invader.row) ? invader.row % 3 : 0);
      const type = Math.max(0, Math.min(2, Number.isFinite(rawType) ? rawType : 0));
      const index = cursors[type]++;
      position.set(invader.x, invader.y, invader.z ?? 0);
      const bob = Math.sin(this.time * 5.5 + (invader.slot ?? index) * 0.7) * 0.035;
      position.y += bob;
      quaternion.setFromEuler(new THREE.Euler(0, 0, Math.sin(this.time * 2 + index) * 0.025));
      matrix.compose(position, quaternion, scale);
      this.meshes[type].setMatrixAt(index, matrix);
    }
    for (let type = 0; type < this.meshes.length; type += 1) {
      for (let index = cursors[type]; index < 55; index += 1) {
        hidden(matrix);
        this.meshes[type].setMatrixAt(index, matrix);
      }
      this.meshes[type].instanceMatrix.needsUpdate = true;
    }
  }

  update(realDelta) {
    this.time += realDelta;
    for (let type = 0; type < this.materials.length; type += 1) {
      this.materials[type].emissiveIntensity = 0.85 + Math.sin(this.time * 4 + type) * 0.22;
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
