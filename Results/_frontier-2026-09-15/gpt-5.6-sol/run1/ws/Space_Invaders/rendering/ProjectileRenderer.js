import * as THREE from 'three';
import { lerp } from '../../shared/math/MathUtils.js';
import { CONFIG, PALETTE } from '../config.js';
import { createProjectileGeometries } from './GeometryFactory.js';

export class ProjectileRenderer {
  constructor(scene, tracker, materials) {
    this.scene = scene;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.counts = new Uint16Array(3);
    const geometries = createProjectileGeometries();
    this.playerMesh = this._createMesh(geometries[0], materials.playerProjectile, CONFIG.player.projectilePool, 'player-projectiles');
    this.enemyMeshes = [0, 1, 2].map((type) => this._createMesh(
      geometries[type + 1],
      materials.enemyProjectiles[type],
      CONFIG.enemy.projectilePool,
      `enemy-projectiles-${type}`,
    ));
    this.telegraphGeometry = new THREE.TorusGeometry(0.23, 0.042, 5, 16);
    this.telegraphMesh = this._createMesh(
      this.telegraphGeometry,
      materials.enemyProjectiles[1],
      CONFIG.enemy.pendingPool,
      'enemy-telegraphs',
    );
    for (const mesh of [this.playerMesh, ...this.enemyMeshes, this.telegraphMesh]) tracker.track(mesh);
  }

  _createMesh(geometry, material, capacity, name) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
    return mesh;
  }

  update(simulation, alpha, elapsed) {
    let packed = 0;
    const player = simulation.playerProjectiles;
    for (let id = 0; id < player.capacity; id += 1) {
      if (!player.pool.isActive(id)) continue;
      this.dummy.position.set(
        lerp(player.previousX[id], player.x[id], alpha),
        lerp(player.previousY[id], player.y[id], alpha),
        0.12,
      );
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.playerMesh.setMatrixAt(packed, this.dummy.matrix);
      this.color.setHex(PALETTE.cyan).multiplyScalar(2.2);
      this.playerMesh.setColorAt(packed, this.color);
      packed += 1;
    }
    this.playerMesh.count = packed;
    this.playerMesh.instanceMatrix.needsUpdate = true;
    if (this.playerMesh.instanceColor) this.playerMesh.instanceColor.needsUpdate = true;

    const counts = this.counts;
    counts.fill(0);
    const enemy = simulation.enemyProjectiles;
    for (let id = 0; id < enemy.capacity; id += 1) {
      if (!enemy.pool.isActive(id)) continue;
      const type = enemy.kind[id];
      const mesh = this.enemyMeshes[type];
      const index = counts[type]++;
      this.dummy.position.set(
        lerp(enemy.previousX[id], enemy.x[id], alpha),
        lerp(enemy.previousY[id], enemy.y[id], alpha),
        0.1,
      );
      this.dummy.rotation.set(0, 0, type === 2 ? Math.atan2(enemy.vy[id], enemy.vx[id]) + Math.PI * 0.5 : elapsed * (type === 1 ? 7 : 0));
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
      this.color.setHex(type === 0 ? PALETTE.red : type === 1 ? PALETTE.amber : PALETTE.magenta).multiplyScalar(2);
      mesh.setColorAt(index, this.color);
    }
    for (let type = 0; type < 3; type += 1) {
      const mesh = this.enemyMeshes[type];
      mesh.count = counts[type];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    packed = 0;
    const pending = simulation.pendingAttacks;
    for (let id = 0; id < pending.capacity; id += 1) {
      if (!pending.pool.isActive(id)) continue;
      const shooter = pending.shooter[id];
      if (simulation.invaders.alive[shooter] === 0) continue;
      const pulse = 0.78 + 0.3 * Math.sin(elapsed * 28 + id);
      this.dummy.position.set(
        simulation.formation.originX + simulation.invaders.localX[shooter],
        simulation.formation.originY + simulation.invaders.localY[shooter] - 0.48,
        0.04,
      );
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(pulse);
      this.dummy.updateMatrix();
      this.telegraphMesh.setMatrixAt(packed++, this.dummy.matrix);
    }
    this.telegraphMesh.count = packed;
    this.telegraphMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.playerMesh, ...this.enemyMeshes, this.telegraphMesh);
  }
}
