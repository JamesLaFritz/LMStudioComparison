import * as THREE from 'three';
import { GAME_CONFIG } from '../config.js';

function isSolid(rows, shield, row, column, height) {
  if (row < 0 || row >= height || column < 0 || column >= GAME_CONFIG.SHIELDS.WIDTH) return false;
  return (rows[shield * height + row] & (1 << column)) !== 0;
}

export class ShieldView {
  constructor({ root, assets }) {
    if (!root?.isObject3D) throw new TypeError('ShieldView requires an Object3D root.');
    this.root = root;
    this.assets = assets;
    const config = GAME_CONFIG.SHIELDS;
    this.capacity = config.COUNT * config.WIDTH * config.HEIGHT;
    this.rows = new Uint32Array(config.COUNT * config.HEIGHT);
    this.slotToCell = new Int32Array(this.capacity);
    this.lastDirtyVersion = -1;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.detached = false;
    this.mesh = new THREE.InstancedMesh(assets.geometries.bunkerCell, assets.materials.bunker, this.capacity);
    this.mesh.name = 'destructible-bunker-cells';
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(0xffffff));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    // The field receives the tightly bounded deck shadow, but does not render
    // 1,144 tiny cells into the shadow map a second time. Their bevels and rim
    // light already provide the intended dimensional separation.
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    root.add(this.mesh);
  }

  sync(shieldField) {
    if (!shieldField) return;
    if (shieldField.dirtyVersion === this.lastDirtyVersion) return;
    shieldField.copyRows(this.rows);
    const config = GAME_CONFIG.SHIELDS;
    const logicalScale = this.assets.logicalScale;
    const centerX = this.assets.logicalCenterX;
    const centerY = this.assets.logicalCenterY;
    const originY = config.CENTER_Y - config.HEIGHT * 0.5;
    let count = 0;

    for (let shield = 0; shield < config.COUNT; shield += 1) {
      const originX = config.CENTERS_X[shield] - config.WIDTH * 0.5;
      for (let row = 0; row < config.HEIGHT; row += 1) {
        const bits = this.rows[shield * config.HEIGHT + row];
        if (bits === 0) continue;
        for (let column = 0; column < config.WIDTH; column += 1) {
          if ((bits & (1 << column)) === 0) continue;
          const logicalX = originX + column + 0.5;
          const logicalY = originY + row + 0.5;
          this.dummy.position.set(
            (logicalX - centerX) * logicalScale,
            (logicalY - centerY) * logicalScale,
            0.03,
          );
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(count, this.dummy.matrix);

          const exposed = !isSolid(this.rows, shield, row - 1, column, config.HEIGHT)
            || !isSolid(this.rows, shield, row + 1, column, config.HEIGHT)
            || !isSolid(this.rows, shield, row, column - 1, config.HEIGHT)
            || !isSolid(this.rows, shield, row, column + 1, config.HEIGHT);
          this.color.set(exposed ? 0x90f4f3 : 0x4bb9c4);
          this.mesh.setColorAt(count, this.color);
          this.slotToCell[count] = shield * config.WIDTH * config.HEIGHT + row * config.WIDTH + column;
          count += 1;
        }
      }
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    this.lastDirtyVersion = shieldField.dirtyVersion;
  }

  markGpuDataDirty() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  reset() {
    this.mesh.count = 0;
    this.lastDirtyVersion = -1;
    this.slotToCell.fill(-1);
  }

  detach() {
    if (this.detached) return;
    this.reset();
    this.mesh.removeFromParent();
    this.detached = true;
  }
}
