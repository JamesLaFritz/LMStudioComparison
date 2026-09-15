import * as THREE from 'three';

/**
 * InstancedMesh builder utility.
 * Creates and manages InstancedMesh instances with per-instance matrix/color transforms.
 */
export class InstancedBuilder {
  /**
   * @param {THREE.BufferGeometry} geometry - Base geometry for instancing
   * @param {number} count - Maximum number of instances
   * @param {THREE.Material} material - Material to apply to all instances
   * @returns {THREE.InstancedMesh} The constructed InstancedMesh
   */
  static build(geometry, count, material) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.count = 0;
    return mesh;
  }

  /**
   * Set the transform and color for a single instance.
   * @param {THREE.InstancedMesh} mesh
   * @param {number} index
   * @param {THREE.Vector3} position
   * @param {THREE.Quaternion} [rotation] - Optional quaternion rotation
   * @param {THREE.Vector3} [scale] - Optional scale (default 1,1,1)
   * @param {THREE.Color} [color] - Optional instance color override
   */
  static setInstance(mesh, index, position, rotation = null, scale = null, color = null) {
    const matrix = new THREE.Matrix4();

    if (rotation && scale) {
      matrix.compose(
        position.clone(),
        rotation.clone(),
        scale.clone()
      );
    } else if (scale) {
      matrix.compose(position, new THREE.Quaternion(), scale);
    } else if (rotation) {
      const s = new THREE.Vector3(1, 1, 1);
      matrix.compose(position, rotation, s);
    } else {
      matrix.setPosition(position);
    }

    mesh.setMatrixAt(index, matrix);

    if (color && mesh.instanceColor) {
      mesh.setColorAt(index, color);
    }

    mesh.count = index + 1;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Hide an instance by setting its scale to zero.
   * @param {THREE.InstancedMesh} mesh
   * @param {number} index
   */
  static hideInstance(mesh, index) {
    const matrix = new THREE.Matrix4();
    const s = new THREE.Vector3(0, 0, 0);
    matrix.compose(new THREE.Vector3(), new THREE.Quaternion(), s);
    mesh.setMatrixAt(index, matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Dispose of all resources associated with an InstancedMesh.
   * @param {THREE.InstancedMesh} mesh
   */
  static dispose(mesh) {
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  }
}
