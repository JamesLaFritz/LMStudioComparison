import * as THREE from 'three';
import { GAME_CONFIG } from '../config.js';
import { getAlienX, getAlienY } from '../simulation/FormationSystem.js';
import { fromFixed } from '../simulation/FixedPoint.js';

function casteForRow(row) {
  if (row >= 4) return 2;
  if (row >= 2) return 1;
  return 0;
}

export class FormationView {
  constructor({ root, assets }) {
    if (!root?.isObject3D) throw new TypeError('FormationView requires an Object3D root.');
    this.root = root;
    this.assets = assets;
    this.meshes = Array.from({ length: 3 }, () => new Array(2));
    this.counts = Array.from({ length: 3 }, () => new Uint8Array(2));
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.detached = false;

    for (let caste = 0; caste < 3; caste += 1) {
      for (let pose = 0; pose < 2; pose += 1) {
        const mesh = new THREE.InstancedMesh(
          assets.geometries.alien[caste][pose],
          assets.materials.alien[caste],
          GAME_CONFIG.FORMATION.COUNT,
        );
        mesh.name = `alien-caste-${caste}-pose-${pose}`;
        mesh.count = 0;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.setColorAt(0, new THREE.Color(0xffffff));
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        root.add(mesh);
        this.meshes[caste][pose] = mesh;
      }
    }
  }

  sync(state, realTime = 0) {
    if (!state?.pools?.aliens) return;
    for (const casteCounts of this.counts) casteCounts.fill(0);
    const pose = state.formation?.pose & 1;
    const direction = state.formation?.direction < 0 ? -1 : 1;
    const stepCount = state.formation?.stepCount ?? 0;
    const pulseHead = ((realTime * 7.5 + stepCount * 0.17) % 1 + 1) % 1;
    const logicalScale = this.assets.logicalScale;
    const centerX = this.assets.logicalCenterX;
    const centerY = this.assets.logicalCenterY;

    state.pools.aliens.forEachActive((alien) => {
      const caste = casteForRow(alien.row);
      const index = this.counts[caste][pose]++;
      const logicalX = fromFixed(getAlienX(state, alien));
      const logicalY = fromFixed(getAlienY(state, alien));
      const columnPhase = direction > 0 ? alien.column / 10 : 1 - alien.column / 10;
      const distance = Math.abs(columnPhase - pulseHead);
      const wrappedDistance = Math.min(distance, 1 - distance);
      const pulse = Math.max(0, 1 - wrappedDistance * 9);
      const scale = 1 + pulse * 0.035;

      this.dummy.position.set(
        (logicalX - centerX) * logicalScale,
        (logicalY - centerY) * logicalScale,
        0,
      );
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();
      const mesh = this.meshes[caste][pose];
      mesh.setMatrixAt(index, this.dummy.matrix);
      this.color.set(caste === 0 ? 0xff67d7 : caste === 1 ? 0xcb78ff : 0xc98242);
      this.color.multiplyScalar(caste === 2 ? 0.66 + pulse * 0.18 : 0.72 + pulse * 0.28);
      mesh.setColorAt(index, this.color);
    });

    for (let caste = 0; caste < 3; caste += 1) {
      for (let candidatePose = 0; candidatePose < 2; candidatePose += 1) {
        const mesh = this.meshes[caste][candidatePose];
        mesh.count = this.counts[caste][candidatePose];
        mesh.visible = candidatePose === pose;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        if (mesh.count > 0) mesh.computeBoundingSphere();
      }
    }
  }

  markGpuDataDirty() {
    for (const pair of this.meshes) {
      for (const mesh of pair) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  reset() {
    for (const pair of this.meshes) {
      for (const mesh of pair) mesh.count = 0;
    }
  }

  detach() {
    if (this.detached) return;
    this.reset();
    for (const pair of this.meshes) for (const mesh of pair) mesh.removeFromParent();
    this.detached = true;
  }
}
