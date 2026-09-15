import * as THREE from 'three';

/**
 * Procedural Geometry Generator for Space Invaders
 * All geometries are created via Three.js primitives and ExtrudeGeometry
 */

/**
 * Create player ship geometry - sleek angular fighter shape
 */
export function createPlayerShipGeometry() {
  const shape = new THREE.Shape();
  
  // Main body - triangular with pointed nose
  shape.moveTo(0, -12);
  shape.lineTo(8, 4);
  shape.lineTo(5, 6);
  shape.lineTo(-5, 6);
  shape.lineTo(-8, 4);
  shape.closePath();
  
  // Engine detail (hole)
  const engineHole = new THREE.Path();
  engineHole.absarc(0, -2, 3, Math.PI, 0, false);
  shape.holes.push(engineHole);
  
  const extrudeSettings = {
    depth: 2,
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.5,
    bevelSegments: 2
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

/**
 * Create invader geometry based on type
 * @param {'squid' | 'crab' | 'octopus'} type 
 */
export function createInvaderGeometry(type) {
  let shape;
  
  switch (type) {
    case 'squid':
      // Triangular body with legs - top row, most valuable
      shape = new THREE.Shape();
      shape.moveTo(0, -8);
      shape.lineTo(6, -4);
      shape.lineTo(4, 0);
      shape.lineTo(2, 4);
      shape.lineTo(-2, 4);
      shape.lineTo(-4, 0);
      shape.lineTo(-6, -4);
      shape.closePath();
      
      // Eye holes
      const leftEye = new THREE.Path();
      leftEye.absarc(-2.5, -1, 1, 0, Math.PI * 2, false);
      const rightEye = new THREE.Path();
      rightEye.absarc(2.5, -1, 1, 0, Math.PI * 2, false);
      shape.holes.push(leftEye);
      shape.holes.push(rightEye);
      break;
      
    case 'crab':
      // Wide body with claws - middle rows
      shape = new THREE.Shape();
      shape.moveTo(-8, -4);
      shape.lineTo(8, -4);
      shape.lineTo(10, 0);
      shape.lineTo(6, 4);
      shape.lineTo(-6, 4);
      shape.lineTo(-10, 0);
      shape.closePath();
      
      // Central body detail
      const bodyHole = new THREE.Path();
      bodyHole.absarc(0, 0, 3, 0, Math.PI * 2, false);
      shape.holes.push(bodyHole);
      break;
      
    case 'octopus':
      // Rounded with tentacles - bottom rows, most common
      shape = new THREE.Shape();
      shape.moveTo(0, -6);
      shape.lineTo(7, -2);
      shape.lineTo(8, 2);
      shape.lineTo(4, 5);
      shape.lineTo(-4, 5);
      shape.lineTo(-8, 2);
      shape.lineTo(-7, -2);
      shape.closePath();
      
      // Tentacle notches (simplified as holes)
      const tent1 = new THREE.Path();
      tent1.absarc(-3, 0, 1.5, Math.PI, 0, false);
      const tent2 = new THREE.Path();
      tent2.absarc(3, 0, 1.5, Math.PI, 0, false);
      shape.holes.push(tent1);
      shape.holes.push(tent2);
      break;
      
    default:
      // Fallback simple box
      return new THREE.BoxGeometry(8, 8, 2);
  }
  
  const extrudeSettings = {
    depth: 1.5,
    bevelEnabled: true,
    bevelThickness: 0.3,
    bevelSize: 0.3,
    bevelSegments: 1
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

/**
 * Create bullet geometry - elongated cylinder with glow tip
 */
export function createBulletGeometry() {
  const geometry = new THREE.CylinderGeometry(0.4, 0.4, 6, 8);
  geometry.rotateX(Math.PI / 2); // Point along Z axis initially
  
  return geometry;
}

/**
 * Create enemy bullet geometry - larger, more menacing
 */
export function createEnemyBulletGeometry() {
  const geometry = new THREE.ConeGeometry(0.6, 4, 8);
  geometry.rotateX(-Math.PI / 2); // Point downward
  
  return geometry;
}

/**
 * Create explosion particle geometry - small tetrahedron for variety
 */
export function createParticleGeometry() {
  const geometries = [
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.OctahedronGeometry(0.25),
    new THREE.DodecahedronGeometry(0.2)
  ];
  
  // Return array for variety in particle system
  return geometries;
}

/**
 * Create shockwave ring geometry - torus with high segment count
 */
export function createShockwaveGeometry() {
  return new THREE.TorusGeometry(1, 0.25, 8, 64);
}

/**
 * Create starfield geometry - many small points at various depths
 * Returns array of Mesh objects for immediate use
 */
export function createStarfield(scene, count = 200) {
  const stars = [];
  const starGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  
  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x444444,
      emissiveIntensity: 0.5
    });
    
    const star = new THREE.Mesh(starGeometry, material);
    
    // Random position in 3D space behind gameplay area
    star.position.set(
      (Math.random() - 0.5) * 1200,
      (Math.random() - 0.5) * 800,
      -50 - Math.random() * 200 // Behind main scene
    );
    
    // Random scale for depth effect
    const scale = 0.3 + Math.random() * 0.7;
    star.scale.setScalar(scale);
    
    // Store parallax speed based on Z position (further = slower)
    star.userData.parallaxSpeed = 1 - (star.position.z + 50) / 200;
    
    scene.add(star);
    stars.push(star);
  }
  
  return stars;
}

/**
 * Create mothership geometry - large boss entity
 */
export function createMothershipGeometry() {
  const shape = new THREE.Shape();
  
  // Main saucer body
  shape.moveTo(0, -15);
  shape.lineTo(25, -8);
  shape.lineTo(35, 0);
  shape.lineTo(25, 8);
  shape.lineTo(-25, 8);
  shape.lineTo(-35, 0);
  shape.lineTo(-25, -8);
  shape.closePath();
  
  // Cockpit dome (hole)
  const cockpit = new THREE.Path();
  cockpit.absarc(0, 0, 8, 0, Math.PI * 2, false);
  shape.holes.push(cockpit);
  
  const extrudeSettings = {
    depth: 4,
    bevelEnabled: true,
    bevelThickness: 1,
    bevelSize: 1,
    bevelSegments: 3
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

/**
 * Create grid background geometry - retro scanline effect
 */
export function createGridBackground(width = 800, height = 600) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // Dark background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, width, height);
  
  // Horizontal scanlines
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  
  for (let y = 0; y < height; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Vertical grid lines (fainter)
  ctx.strokeStyle = 'rgba(255, 0, 255, 0.02)';
  
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  
  return texture;
}

/**
 * Pre-create and cache geometries for performance
 */
export class GeometryCache {
  constructor() {
    this.cached = new Map();
  }
  
  get(key, createFn) {
    if (!this.cached.has(key)) {
      this.cached.set(key, createFn());
    }
    return this.cached.get(key);
  }
  
  clear() {
    for (const [key, geom] of this.cached.entries()) {
      geom.dispose();
    }
    this.cached.clear();
  }
}

// Export a shared cache instance
export const geometryCache = new GeometryCache();
