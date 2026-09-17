import * as THREE from 'three';
import { GAME_CONFIG } from '@space/GameConfig.js';

export function createSceneContext() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030711);
  scene.fog = new THREE.FogExp2(0x06101e, 0.022);

  const environmentRoot = new THREE.Group();
  environmentRoot.name = 'environment-root';
  const gameRoot = new THREE.Group();
  gameRoot.name = 'game-root';
  const fxRoot = new THREE.Group();
  fxRoot.name = 'fx-root';
  scene.add(environmentRoot, gameRoot, fxRoot);

  const ambient = new THREE.AmbientLight(0x5e7dac, 0.72);
  const key = new THREE.DirectionalLight(0x9cd7ff, 2.25);
  key.position.set(-5, 8, 9);
  const rim = new THREE.PointLight(0xff4cb8, 12, 19, 2);
  rim.position.set(0, 3.4, 5);
  const playerGlow = new THREE.PointLight(GAME_CONFIG.colors.player, 3.2, 7, 2);
  playerGlow.position.set(0, GAME_CONFIG.world.playerY + 0.6, 1.5);
  scene.add(ambient, key, rim, playerGlow);

  return {
    scene,
    environmentRoot,
    gameRoot,
    fxRoot,
    playerGlow,
  };
}
