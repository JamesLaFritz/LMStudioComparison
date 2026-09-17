import * as THREE from 'three';
import { lerp } from '../../shared/math/MathUtils.js';
import { CONFIG } from '../config.js';
import {
  createInvaderGeometries,
  createPlayerGeometry,
  createUfoGeometry,
} from './GeometryFactory.js';

export class FleetRenderer {
  constructor(scene, tracker, materials) {
    this.scene = scene;
    this.tracker = tracker;
    this.materials = materials;
    this.group = new THREE.Group();
    this.group.name = 'fleet';
    this.dummy = new THREE.Object3D();
    this.packCounts = new Uint16Array(3);

    this.player = new THREE.Mesh(createPlayerGeometry(), materials.playerHull);
    this.player.name = 'player-cannon';
    this.player.position.y = CONFIG.player.y;
    this.group.add(this.player);

    const barrelGeometry = new THREE.BoxGeometry(0.14, 0.5, 0.14);
    this.playerBarrel = new THREE.Mesh(barrelGeometry, materials.playerGlow);
    this.playerBarrel.position.set(0, 0.48, 0.02);
    this.player.add(this.playerBarrel);

    const invaderGeometries = createInvaderGeometries();
    const capacities = [11, 22, 22];
    this.invaderMeshes = invaderGeometries.map((poses, type) => poses.map((geometry, pose) => {
      const mesh = new THREE.InstancedMesh(geometry, materials.invaders[type], capacities[type]);
      mesh.name = `invaders-${type}-pose-${pose}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
      return mesh;
    }));

    this.ufo = new THREE.Mesh(createUfoGeometry(), materials.ufo);
    this.ufo.name = 'mystery-ufo';
    this.ufo.visible = false;
    this.group.add(this.ufo);
    scene.add(this.group);
    tracker.track(this.group);
  }

  update(simulation, alpha, elapsed) {
    const playerX = lerp(simulation.player.previousX, simulation.player.x, alpha);
    this.player.position.set(playerX, CONFIG.player.y, 0.08);
    this.player.rotation.z = -simulation.player.vx * 0.012;
    const invulnerablePulse = simulation.player.invulnerabilityTimer > 0
      ? 1.7 + Math.sin(elapsed * 28) * 1.1
      : 2.2;
    this.materials.playerGlow.emissiveIntensity = invulnerablePulse;
    const blink = simulation.player.invulnerabilityTimer > 0 && Math.floor(elapsed * 18) % 2 === 0;
    this.player.visible = simulation.player.active && !blink;

    const renderOriginX = simulation.formation.renderX();
    const renderOriginY = simulation.formation.renderY();
    const phase = simulation.formation.phase;
    this.packCounts.fill(0);
    for (let type = 0; type < 3; type += 1) {
      this.invaderMeshes[type][0].count = 0;
      this.invaderMeshes[type][1].count = 0;
    }

    for (let id = 0; id < simulation.invaders.capacity; id += 1) {
      if (simulation.invaders.alive[id] === 0) continue;
      const type = simulation.invaders.archetype[id];
      const mesh = this.invaderMeshes[type][phase];
      const index = this.packCounts[type]++;
      const microBob = Math.sin(elapsed * 3.2 + id * 0.47) * 0.025;
      this.dummy.position.set(
        renderOriginX + simulation.invaders.localX[id],
        renderOriginY + simulation.invaders.localY[id] + microBob,
        -0.03 - type * 0.04,
      );
      this.dummy.rotation.set(0.035 * Math.sin(elapsed * 1.7 + id), 0, simulation.formation.direction * -0.018);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
    }

    for (let type = 0; type < 3; type += 1) {
      const mesh = this.invaderMeshes[type][phase];
      mesh.count = this.packCounts[type];
      mesh.instanceMatrix.needsUpdate = true;
    }

    this.ufo.visible = simulation.ufo.active;
    if (simulation.ufo.active) {
      this.ufo.position.set(
        lerp(simulation.ufo.previousX, simulation.ufo.x, alpha),
        simulation.ufo.y,
        -0.02,
      );
      this.ufo.rotation.y = elapsed * 1.4;
      this.ufo.rotation.z = Math.sin(elapsed * 5) * 0.035;
    }
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
