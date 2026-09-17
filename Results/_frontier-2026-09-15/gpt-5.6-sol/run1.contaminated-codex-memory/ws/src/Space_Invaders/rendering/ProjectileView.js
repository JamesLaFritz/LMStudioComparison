import * as THREE from 'three';
import { GAME_CONFIG } from '../config.js';
import { fromFixed } from '../simulation/FixedPoint.js';

const ROLES = Object.freeze(['player', 'rolling', 'plunger', 'squiggly']);
const POOL_KEYS = Object.freeze(['playerShots', 'rollingShots', 'plungerShots', 'squigglyShots']);
const COLORS = Object.freeze([0x35e8ff, 0xff3fcb, 0xff405f, 0xffb84d]);
const WIDTHS = Object.freeze([0.045, 0.07, 0.085, 0.075]);

function visitActive(pool, visitor) {
  pool?.forEachActive?.(visitor);
}

export class ProjectileView {
  constructor({ root, assets }) {
    if (!root?.isObject3D) throw new TypeError('ProjectileView requires an Object3D root.');
    this.root = root;
    this.assets = assets;
    this.dummy = new THREE.Object3D();
    this.meshes = new Array(4);
    this.sampleActive = new Uint8Array(4);
    this.sampleX = new Float32Array(4);
    this.sampleY = new Float32Array(4);
    this.sampleZ = new Float32Array(4);
    this.samplePrevX = new Float32Array(4);
    this.samplePrevY = new Float32Array(4);
    this.samplePrevZ = new Float32Array(4);
    this.detached = false;

    for (let index = 0; index < 4; index += 1) {
      const role = ROLES[index];
      const geometry = assets.geometries[`projectile${role[0].toUpperCase()}${role.slice(1)}`];
      const material = assets.materials[`projectile${role[0].toUpperCase()}${role.slice(1)}`];
      const mesh = new THREE.InstancedMesh(geometry, material, 1);
      mesh.name = `projectile-${role}`;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      root.add(mesh);
      this.meshes[index] = mesh;
    }
  }

  sync(pools, alpha = 1, realTime = 0) {
    const interpolation = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
    const logicalScale = this.assets.logicalScale;
    const centerX = this.assets.logicalCenterX;
    const centerY = this.assets.logicalCenterY;
    this.sampleActive.fill(0);

    for (let roleIndex = 0; roleIndex < 4; roleIndex += 1) {
      const mesh = this.meshes[roleIndex];
      mesh.count = 0;
      visitActive(pools?.[POOL_KEYS[roleIndex]], (projectile) => {
        if (mesh.count >= 1) return;
        const previousLogicalX = fromFixed(projectile.prevX);
        const previousLogicalY = fromFixed(projectile.prevY);
        const currentLogicalX = fromFixed(projectile.x);
        const currentLogicalY = fromFixed(projectile.y);
        const logicalX = previousLogicalX + (currentLogicalX - previousLogicalX) * interpolation;
        const logicalY = previousLogicalY + (currentLogicalY - previousLogicalY) * interpolation;
        const worldX = (logicalX - centerX) * logicalScale;
        const worldY = (logicalY - centerY) * logicalScale;
        const currentWorldX = (currentLogicalX - centerX) * logicalScale;
        const currentWorldY = (currentLogicalY - centerY) * logicalScale;
        const previousWorldX = (previousLogicalX - centerX) * logicalScale;
        const previousWorldY = (previousLogicalY - centerY) * logicalScale;
        const pulse = 1 + 0.12 * Math.sin(realTime * 28 + roleIndex * 1.7);

        this.dummy.position.set(worldX, worldY, 0.22);
        this.dummy.rotation.set(0, 0, roleIndex === 3 ? realTime * 14 : roleIndex === 1 ? realTime * 8 : 0);
        this.dummy.scale.set(pulse, pulse, pulse);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(0, this.dummy.matrix);
        mesh.count = 1;
        this.sampleActive[roleIndex] = 1;
        // Trails follow authoritative fixed-tick endpoints. Using the
        // interpolated display position here would emit overlapping segments
        // on every render frame between two simulation ticks.
        this.sampleX[roleIndex] = currentWorldX;
        this.sampleY[roleIndex] = currentWorldY;
        this.sampleZ[roleIndex] = 0.2;
        this.samplePrevX[roleIndex] = previousWorldX;
        this.samplePrevY[roleIndex] = previousWorldY;
        this.samplePrevZ[roleIndex] = 0.2;
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  getTrailSamples(visitor, scratch = {}) {
    if (typeof visitor !== 'function') throw new TypeError('Trail sample visitor must be a function.');
    for (let roleIndex = 0; roleIndex < 4; roleIndex += 1) {
      if (!this.sampleActive[roleIndex]) continue;
      scratch.active = true;
      scratch.role = ROLES[roleIndex];
      scratch.ownerId = roleIndex;
      scratch.x = this.sampleX[roleIndex];
      scratch.y = this.sampleY[roleIndex];
      scratch.z = this.sampleZ[roleIndex];
      scratch.prevX = this.samplePrevX[roleIndex];
      scratch.prevY = this.samplePrevY[roleIndex];
      scratch.prevZ = this.samplePrevZ[roleIndex];
      scratch.color = COLORS[roleIndex];
      scratch.width = WIDTHS[roleIndex];
      scratch.life = roleIndex === 0 ? 0.11 : 0.14;
      scratch.priority = roleIndex === 0 ? 1 : 2;
      scratch.minimumDistance = GAME_CONFIG.PROJECTILE.PLAYER_SPEED * 0.01;
      visitor(scratch);
    }
  }

  markGpuDataDirty() {
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  reset() {
    this.sampleActive.fill(0);
    for (const mesh of this.meshes) mesh.count = 0;
  }

  detach() {
    if (this.detached) return;
    this.reset();
    for (const mesh of this.meshes) mesh.removeFromParent();
    this.detached = true;
  }
}
