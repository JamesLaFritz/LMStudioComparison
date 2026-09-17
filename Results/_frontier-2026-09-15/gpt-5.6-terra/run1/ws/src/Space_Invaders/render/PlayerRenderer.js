import * as THREE from 'three';
import { GAME_CONFIG } from '@space/GameConfig.js';
import { createVoxelMaskGeometry } from '@shared/procedural/VoxelGeometryFactory.js';

const PLAYER_MASK = [
  '0001000',
  '0011100',
  '0111110',
  '1111111',
  '1011101',
];

export class PlayerRenderer {
  constructor(parent, playerGlow, registry) {
    this.root = new THREE.Group();
    this.geometry = createVoxelMaskGeometry(PLAYER_MASK, 0.24, 0.42);
    this.material = new THREE.MeshStandardMaterial({
      color: GAME_CONFIG.colors.player,
      emissive: GAME_CONFIG.colors.player,
      emissiveIntensity: 0.82,
      metalness: 0.64,
      roughness: 0.22,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = false;
    this.root.add(this.mesh);

    this.reactorGeometry = new THREE.BoxGeometry(0.24, 0.11, 0.18);
    this.reactorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd35a,
      emissive: 0xff8a2a,
      emissiveIntensity: 1.35,
      metalness: 0.2,
      roughness: 0.2,
    });
    this.reactor = new THREE.Mesh(this.reactorGeometry, this.reactorMaterial);
    this.reactor.position.set(0, -0.55, 0.08);
    this.root.add(this.reactor);
    this.playerGlow = playerGlow;
    parent.add(this.root);
    registry.add(() => this.dispose());
  }

  sync(player, elapsed) {
    this.root.visible = player.alive;
    if (!player.alive) {
      return;
    }
    const flicker = player.invulnerability > 0 && Math.floor(elapsed * 18) % 2 === 0;
    this.mesh.visible = !flicker;
    this.root.position.set(player.x, player.y, 0.14);
    this.reactor.scale.y = 0.8 + Math.sin(elapsed * 16) * 0.26;
    this.material.emissiveIntensity = 0.76 + Math.sin(elapsed * 5) * 0.08;
    this.playerGlow.position.set(player.x, player.y + 0.4, 1.5);
    this.playerGlow.intensity = player.alive ? 2.8 + Math.sin(elapsed * 9) * 0.35 : 0;
  }

  dispose() {
    this.root.removeFromParent();
    this.geometry.dispose();
    this.reactorGeometry.dispose();
    this.material.dispose();
    this.reactorMaterial.dispose();
  }
}
