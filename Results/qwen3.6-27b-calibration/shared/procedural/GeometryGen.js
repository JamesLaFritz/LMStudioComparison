/**
 * GeometryGen — Procedural geometry helpers.
 * Shared across all games.
 */
import * as THREE from 'three';

export class GeometryGen {
  /**
   * Create a rounded box geometry (beveled box).
   */
  static createRoundedBox(width, height, depth, radius = 0.1, segments = 4) {
    // Use BoxGeometry with bevel via ExtrudeGeometry for true rounded edges
    const shape = new THREE.Shape();
    const w = width / 2 - radius;
    const h = height / 2 - radius;

    shape.moveTo(-w, -h - radius);
    shape.lineTo(w, -h - radius);
    shape.quadraticCurveTo(w + radius, -h - radius, w + radius, -h);
    shape.lineTo(w + radius, h);
    shape.quadraticCurveTo(w + radius, h + radius, w, h + radius);
    shape.lineTo(-w, h + radius);
    shape.quadraticCurveTo(-w - radius, h + radius, -w - radius, h);
    shape.lineTo(-w - radius, -h);
    shape.quadraticCurveTo(-w - radius, -h - radius, -w, -h - radius);

    const extrudeSettings = {
      depth: depth,
      bevelEnabled: true,
      bevelThickness: radius * 0.5,
      bevelSize: radius * 0.5,
      bevelSegments: segments,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    return geometry;
  }

  /**
   * Create a court/floor plane with optional grid subdivisions.
   */
  static createCourtPlane(width, height, segments = 1) {
    return new THREE.PlaneGeometry(width, height, segments, segments);
  }

  /**
   * Create a border frame from line segments.
   */
  static createBorderFrame(width, height, depth = 0.05) {
    const points = [
      new THREE.Vector3(-width / 2, 0, -height / 2),
      new THREE.Vector3(width / 2, 0, -height / 2),
      new THREE.Vector3(width / 2, 0, height / 2),
      new THREE.Vector3(-width / 2, 0, height / 2),
      new THREE.Vector3(-width / 2, 0, -height / 2),
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }

  /**
   * Create a center line geometry.
   */
  static createCenterLine(length, segments = 20) {
    const points = [];
    const dashLen = 0.3;
    const gapLen = 0.3;
    let y = -length / 2;

    while (y < length / 2) {
      points.push(new THREE.Vector3(0, y, 0));
      points.push(new THREE.Vector3(0, y + dashLen, 0));
      y += dashLen + gapLen;
    }

    // Build line segments from pairs
    const linePoints = [];
    for (let i = 0; i < points.length - 1; i += 2) {
      linePoints.push(points[i], points[i + 1]);
    }

    return new THREE.BufferGeometry().setFromPoints(linePoints);
  }

  /**
   * Create a sphere with procedural displacement.
   */
  static createDisplacedSphere(radius, widthSegs, heightSegs, displacementFn) {
    const geometry = new THREE.SphereGeometry(radius, widthSegs, heightSegs);
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);

      const displacement = displacementFn(x, y, z);
      const len = Math.sqrt(x * x + y * y + z * z) || 1;

      positions.setX(i, x + (x / len) * displacement);
      positions.setY(i, y + (y / len) * displacement);
      positions.setZ(i, z + (z / len) * displacement);
    }

    geometry.computeVertexNormals();
    return geometry;
  }

  /**
   * Create a simple paddle geometry (rounded box).
   */
  static createPaddleGeometry(width, height, depth, cornerRadius = 0.1) {
    return this.createRoundedBox(width, height, depth, cornerRadius, 3);
  }

  /**
   * Create a goal line marker.
   */
  static createGoalMarker(width, height) {
    const points = [
      new THREE.Vector3(-width / 2, 0, -height / 2),
      new THREE.Vector3(-width / 2, 0, height / 2),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }

  /**
   * Merge multiple geometries into one.
   */
  static mergeGeometries(geometries, matrices = null) {
    // Manual merge since BufferGeometryUtils may not be available
    let totalVertices = 0;
    let totalIndices = 0;

    for (const geo of geometries) {
      totalVertices += geo.attributes.position.count;
      if (geo.index) {
        totalIndices += geo.index.count;
      } else {
        totalIndices += geo.attributes.position.count;
      }
    }

    const merged = new THREE.BufferGeometry();
    const positions = new Float32Array(totalVertices * 3);
    const normals = new Float32Array(totalVertices * 3);
    const indices = totalIndices > 0 ? new Uint32Array(totalIndices) : null;

    let vertexOffset = 0;
    let vertexIndex = 0;
    let indexIndex = 0;

    for (let g = 0; g < geometries.length; g++) {
      const geo = geometries[g];
      const matrix = matrices && matrices[g] ? matrices[g] : new THREE.Matrix4();
      const posAttr = geo.attributes.position;
      const normAttr = geo.attributes.normal;

      const tempVec = new THREE.Vector3();
      const tempNorm = new THREE.Vector3();
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

      for (let i = 0; i < posAttr.count; i++) {
        tempVec.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        tempVec.applyMatrix4(matrix);
        positions[vertexIndex * 3] = tempVec.x;
        positions[vertexIndex * 3 + 1] = tempVec.y;
        positions[vertexIndex * 3 + 2] = tempVec.z;

        if (normAttr) {
          tempNorm.set(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
          tempNorm.applyMatrix3(normalMatrix).normalize();
          normals[vertexIndex * 3] = tempNorm.x;
          normals[vertexIndex * 3 + 1] = tempNorm.y;
          normals[vertexIndex * 3 + 2] = tempNorm.z;
        }

        vertexIndex++;
      }

      if (geo.index) {
        for (let i = 0; i < geo.index.count; i++) {
          indices[indexIndex++] = geo.index.array[i] + vertexOffset;
        }
      } else {
        for (let i = 0; i < posAttr.count; i++) {
          indices[indexIndex++] = i + vertexOffset;
        }
      }

      vertexOffset += posAttr.count;
    }

    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    if (indices) {
      merged.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    return merged;
  }
}
