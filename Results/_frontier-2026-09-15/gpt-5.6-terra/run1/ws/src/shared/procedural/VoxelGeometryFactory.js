import * as THREE from 'three';

function appendFace(positions, normals, a, b, c, d, normal) {
  const vertices = [a, b, c, a, c, d];
  for (let index = 0; index < vertices.length; index += 1) {
    positions.push(vertices[index][0], vertices[index][1], vertices[index][2]);
    normals.push(normal[0], normal[1], normal[2]);
  }
}

function appendBox(positions, normals, x, y, z, halfWidth, halfHeight, halfDepth) {
  const left = x - halfWidth;
  const right = x + halfWidth;
  const bottom = y - halfHeight;
  const top = y + halfHeight;
  const back = z - halfDepth;
  const front = z + halfDepth;

  appendFace(positions, normals, [left, bottom, front], [right, bottom, front], [right, top, front], [left, top, front], [0, 0, 1]);
  appendFace(positions, normals, [right, bottom, back], [left, bottom, back], [left, top, back], [right, top, back], [0, 0, -1]);
  appendFace(positions, normals, [right, bottom, front], [right, bottom, back], [right, top, back], [right, top, front], [1, 0, 0]);
  appendFace(positions, normals, [left, bottom, back], [left, bottom, front], [left, top, front], [left, top, back], [-1, 0, 0]);
  appendFace(positions, normals, [left, top, front], [right, top, front], [right, top, back], [left, top, back], [0, 1, 0]);
  appendFace(positions, normals, [left, bottom, back], [right, bottom, back], [right, bottom, front], [left, bottom, front], [0, -1, 0]);
}

export function createVoxelMaskGeometry(mask, cellSize = 0.22, depth = 0.22) {
  const positions = [];
  const normals = [];
  const rows = mask.length;
  const columns = mask[0].length;
  const halfCell = cellSize * 0.46;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (mask[row][column] !== '1') {
        continue;
      }
      const x = (column - (columns - 1) * 0.5) * cellSize;
      const y = ((rows - 1) * 0.5 - row) * cellSize;
      const z = ((row + column) % 2 === 0 ? 0.03 : -0.03);
      appendBox(positions, normals, x, y, z, halfCell, halfCell, depth * 0.5);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
