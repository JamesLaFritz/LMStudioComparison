import { NEON_COLORS } from '../../shared/constants.js';

/**
 * Procedural alien mesh generator using Canvas API for textures
 * Creates three distinct alien types: Squid (top), Crab (mid), Octopus (bottom)
 */

const ALIEN_SPRITES = {
  squid: [
    '0001111111100',
    '0011111111110',
    '0111111111111',
    '1110111111011',
    '1111111111111',
    '1111101101111',
    '0111111111110',
    '0011001100110',
  ],
  crab: [
    '000001111100000',
    '000011111110000',
    '000111111111000',
    '001111111111100',
    '011111111111110',
    '111111111111111',
    '111111111111111',
    '111110011001111',
    '111110011001111',
    '001110011001110',
  ],
  octopus: [
    '00000011111000000',
    '00001111111110000',
    '00011111111111000',
    '00111111111111100',
    '01111111111111110',
    '11111111111111111',
    '11111111111111111',
    '00111110011111100',
    '00111110011111100',
    '00011001100110000',
  ]
};

const PIXEL_SIZE = 4;
const TEXTURE_PADDING = 2;

/**
 * Generate a CanvasTexture from binary sprite data
 */
function generateAlienTexture(spriteData, color) {
  const rows = spriteData.length;
  const cols = spriteData[0].length;
  
  const canvas = document.createElement('canvas');
  const width = cols * PIXEL_SIZE + TEXTURE_PADDING * 2;
  const height = rows * PIXEL_SIZE + TEXTURE_PADDING * 2;
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  
  // Transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, width, height);
  
  // Draw pixel art
  ctx.fillStyle = color;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (spriteData[row][col] === '1') {
        const x = TEXTURE_PADDING + col * PIXEL_SIZE;
        const y = TEXTURE_PADDING + row * PIXEL_SIZE;
        ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
      }
    }
  }
  
  // Add subtle glow effect via shadow
  ctx.shadowColor = color;
  ctx.shadowBlur = 2;
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  
  return texture;
}

/**
 * Create emissive material for aliens with glow effect
 */
function createAlienMaterial(color) {
  const emissiveIntensity = 1.2;
  
  return new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: color,
    emissiveIntensity: emissiveIntensity,
    metalness: 0.4,
    roughness: 0.3,
    flatShading: true,
    transparent: false
  });
}

/**
 * Create the main alien body mesh with texture and material
 */
export function createAlienMesh(type) {
  const spriteData = ALIEN_SPRITES[type];
  const rows = spriteData.length;
  const cols = spriteData[0].length;
  
  // Calculate dimensions based on pixel art size
  const width = (cols * PIXEL_SIZE + TEXTURE_PADDING * 2) / 16;
  const height = (rows * PIXEL_SIZE + TEXTURE_PADDING * 2) / 16;
  const depth = 0.3;
  
  // Get color based on type
  let color;
  switch (type) {
    case 'squid':
      color = NEON_COLORS.MAGENTA;
      break;
    case 'crab':
      color = NEON_COLORS.GREEN;
      break;
    case 'octopus':
      color = NEON_COLORS.YELLOW;
      break;
    default:
      color = NEON_COLORS.CYAN;
  }
  
  // Create texture
  const texture = generateAlienTexture(spriteData, color);
  
  // Create material with emissive glow
  const material = createAlienMaterial(color);
  
  // Create geometry - use plane for 2D sprite look with slight depth
  const geometry = new THREE.BoxGeometry(width, height, depth);
  
  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  
  // Store texture reference for disposal later
  mesh.userData.texture = texture;
  mesh.userData.type = type;
  
  return { mesh, texture };
}

/**
 * Create animated alien with movement frames (squash/stretch effect)
 */
export function createAnimatedAlien(type) {
  const { mesh, texture } = createAlienMesh(type);
  
  // Add animation properties to userData
  mesh.userData.animation = {
    frame: 0,
    direction: 1,
    baseScale: new THREE.Vector3(1, 1, 1),
    currentScale: new THREE.Vector3(1, 1, 1)
  };
  
  return { mesh, texture };
}

/**
 * Update alien animation (squash/stretch based on movement direction)
 */
export function updateAlienAnimation(mesh, dt, movingRight) {
  const anim = mesh.userData.animation;
  if (!anim) return;
  
  // Determine target scale based on movement state
  let targetScaleX, targetScaleY;
  
  if (movingRight !== null) {
    // Moving - slight stretch in direction of travel
    targetScaleX = movingRight ? 1.08 : 0.92;
    targetScaleY = movingRight ? 0.96 : 1.04;
  } else {
    // Stationary or turning - return to normal
    targetScaleX = 1;
    targetScaleY = 1;
  }
  
  // Smooth interpolation toward target scale
  anim.currentScale.x = THREE.MathUtils.lerp(anim.currentScale.x, targetScaleX, dt * 5);
  anim.currentScale.y = THREE.MathUtils.lerp(anim.currentScale.y, targetScaleY, dt * 5);
  anim.currentScale.z = 1; // Keep depth constant
  
  mesh.scale.copy(anim.currentScale);
}

/**
 * Dispose of alien mesh and its texture
 */
export function disposeAlienMesh(mesh) {
  if (!mesh) return;
  
  const texture = mesh.userData.texture;
  if (texture) {
    texture.dispose();
    texture.image = null;
  }
  
  if (mesh.material) {
    mesh.material.dispose();
  }
  
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }
}

/**
 * Create a simple placeholder alien for debugging or fallback
 */
export function createSimpleAlienMesh(type, color) {
  const geometry = new THREE.BoxGeometry(1, 0.8, 0.3);
  
  const material = new THREE.MeshStandardMaterial({
    color: 0x222222,
    emissive: color,
    emissiveIntensity: 1.0,
    metalness: 0.5,
    roughness: 0.4
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.type = type;
  
  return { mesh };
}

/**
 * Create UFO geometry for the boss entity
 */
export function createUFOGeometry() {
  // Main saucer body
  const saucerGeo = new THREE.SphereGeometry(1.2, 16, 8);
  saucerGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 0.3, 1));
  
  // Dome on top
  const domeGeo = new THREE.SphereGeometry(0.5, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  
  return saucerGeo;
}

/**
 * Create UFO mesh with material
 */
export function createUFOMesh() {
  const geometry = createUFOGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: 0x331144,
    emissive: NEON_COLORS.PURPLE,
    emissiveIntensity: 1.5,
    metalness: 0.7,
    roughness: 0.2
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, geometry, material };
}

/**
 * Dispose UFO mesh resources
 */
export function disposeUFOMesh(meshObj) {
  if (meshObj.geometry) meshObj.geometry.dispose();
  if (meshObj.material) meshObj.material.dispose();
}
