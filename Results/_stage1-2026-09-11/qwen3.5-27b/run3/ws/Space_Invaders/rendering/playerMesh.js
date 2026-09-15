import { NEON_COLORS } from '../../shared/constants.js';

/**
 * Creates the player ship mesh using procedural geometry.
 * Returns a Group containing multiple meshes for visual complexity.
 */
export function createPlayerMesh() {
  const group = new THREE.Group();

  // Main body - triangular fighter shape
  const bodyGeometry = new THREE.ConeGeometry(0.6, 1.2, 4);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: NEON_COLORS.PLAYER,
    emissiveIntensity: 1.2,
    metalness: 0.5,
    roughness: 0.3,
    flatShading: true
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.rotation.x = Math.PI / 2; // Point upward
  body.position.y = 0.3;
  group.add(body);

  // Wings - angular retro-futurism style
  const wingGeometry = new THREE.BoxGeometry(2.4, 0.15, 0.6);
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: NEON_COLORS.PLAYER,
    emissiveIntensity: 0.8,
    metalness: 0.4,
    roughness: 0.4,
    flatShading: true
  });
  const wings = new THREE.Mesh(wingGeometry, wingMaterial);
  wings.position.y = -0.1;
  group.add(wings);

  // Cockpit dome
  const cockpitGeometry = new THREE.SphereGeometry(0.25, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x001133,
    emissive: NEON_COLORS.PLAYER,
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.1,
    transparent: true,
    opacity: 0.9
  });
  const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
  cockpit.position.y = 0.4;
  group.add(cockpit);

  // Engine glow - emissive thruster
  const engineGeometry = new THREE.CylinderGeometry(0.15, 0.25, 0.3, 8);
  const engineMaterial = new THREE.MeshStandardMaterial({
    color: 0x0044ff,
    emissive: NEON_COLORS.PLAYER,
    emissiveIntensity: 2.0,
    metalness: 0.9,
    roughness: 0.1
  });
  const engine = new THREE.Mesh(engineGeometry, engineMaterial);
  engine.rotation.x = Math.PI / 2;
  engine.position.y = -0.45;
  group.add(engine);

  // Engine glow core (brighter center)
  const engineCoreGeometry = new THREE.CylinderGeometry(0.08, 0.12, 0.2, 8);
  const engineCoreMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: NEON_COLORS.PLAYER,
    emissiveIntensity: 3.0,
    metalness: 1.0,
    roughness: 0.0
  });
  const engineCore = new THREE.Mesh(engineCoreGeometry, engineCoreMaterial);
  engineCore.rotation.x = Math.PI / 2;
  engineCore.position.y = -0.45;
  group.add(engineCore);

  return { mesh: group, bodyMaterial, wingMaterial, cockpitMaterial, engineMaterial, engineCoreMaterial };
}

/**
 * Disposes all materials from a player mesh.
 */
export function disposePlayerMesh(meshObj) {
  if (meshObj.bodyMaterial) meshObj.bodyMaterial.dispose();
  if (meshObj.wingMaterial) meshObj.wingMaterial.dispose();
  if (meshObj.cockpitMaterial) meshObj.cockpitMaterial.dispose();
  if (meshObj.engineMaterial) meshObj.engineMaterial.dispose();
  if (meshObj.engineCoreMaterial) meshObj.engineCoreMaterial.dispose();
}

/**
 * Creates a shield effect mesh for power-up.
 */
export function createShieldMesh() {
  const geometry = new THREE.SphereGeometry(1.2, 16, 16);
  const material = new THREE.MeshStandardMaterial({
    color: NEON_COLORS.SHIELD,
    emissive: NEON_COLORS.SHIELD,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    wireframe: true
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, material };
}

/**
 * Disposes shield mesh materials.
 */
export function disposeShieldMesh(meshObj) {
  if (meshObj.material) meshObj.material.dispose();
}
