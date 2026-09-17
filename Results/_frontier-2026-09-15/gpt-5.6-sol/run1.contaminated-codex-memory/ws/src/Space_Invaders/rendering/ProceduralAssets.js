import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GAME_CONFIG } from '../config.js';

const ALIEN_MASKS = Object.freeze([
  Object.freeze([
    Object.freeze(['00111100', '11111111', '11011011', '11111111', '00100100', '01000010']),
    Object.freeze(['00111100', '11111111', '11011011', '11111111', '01000010', '10000001']),
  ]),
  Object.freeze([
    Object.freeze(['00100100', '00011000', '01111110', '11011011', '11111111', '00100100']),
    Object.freeze(['00100100', '10011001', '11111111', '01111110', '00111100', '01000010']),
  ]),
  Object.freeze([
    Object.freeze(['00011000', '00111100', '01111110', '11011011', '11111111', '01000010']),
    Object.freeze(['00011000', '00111100', '01111110', '11011011', '11111111', '00100100']),
  ]),
]);

function trackGeometry(tracker, geometry, name) {
  geometry.name = name;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  tracker?.track(geometry);
  return geometry;
}

function rectangleShape(width, height) {
  const shape = new THREE.Shape();
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  shape.moveTo(-halfWidth, -halfHeight);
  shape.lineTo(halfWidth, -halfHeight);
  shape.lineTo(halfWidth, halfHeight);
  shape.lineTo(-halfWidth, halfHeight);
  shape.closePath();
  return shape;
}

function createAlienGeometry(mask, width, tracker, name) {
  const rows = mask.length;
  const columns = mask[0].length;
  const cell = width / columns;
  const height = 0.78;
  const cellHeight = height / rows;
  const pieces = [];
  const extrude = {
    depth: 0.26,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.min(cell, cellHeight) * 0.12,
    bevelThickness: 0.025,
    curveSegments: 1,
    steps: 1,
  };
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (mask[row][column] !== '1') continue;
      const shape = rectangleShape(cell * 0.82, cellHeight * 0.82);
      const piece = new THREE.ExtrudeGeometry(shape, extrude);
      piece.translate(
        (column - (columns - 1) * 0.5) * cell,
        ((rows - 1) * 0.5 - row) * cellHeight,
        -extrude.depth * 0.5,
      );
      pieces.push(piece);
    }
  }
  const merged = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  if (!merged) throw new Error(`Could not merge procedural alien geometry ${name}.`);
  return trackGeometry(tracker, merged, name);
}

function createExtrudedShape(points, depth, tracker, name, {
  bevelSegments = 2,
  bevelSize = 0.035,
  bevelThickness = 0.04,
} = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) shape.lineTo(points[index][0], points[index][1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments,
    bevelSize,
    bevelThickness,
    curveSegments: 1,
    steps: 1,
  });
  geometry.translate(0, 0, -depth * 0.5);
  return trackGeometry(tracker, geometry, name);
}

function createHullTextures(textures) {
  const albedo = textures.fromPainter('space-hull-albedo', 256, 256, (context, canvas, rng) => {
    context.fillStyle = '#29455f';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, 'rgba(53,232,255,0.12)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(255,63,203,0.11)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(150,205,225,0.16)';
    context.lineWidth = 1;
    for (let line = -canvas.height; line < canvas.width; line += 23) {
      context.beginPath();
      context.moveTo(line, 0);
      context.lineTo(line + canvas.height, canvas.height);
      context.stroke();
    }
    for (let index = 0; index < 72; index += 1) {
      const x = rng.nextFloat() * canvas.width;
      const y = rng.nextFloat() * canvas.height;
      context.fillStyle = `rgba(210,235,245,${(0.08 + rng.nextFloat() * 0.14).toFixed(3)})`;
      context.fillRect(x, y, 1 + rng.nextFloat() * 2, 1);
    }
  });

  const roughness = textures.fromPainter(
    'space-hull-roughness',
    256,
    256,
    (context, canvas, rng) => {
      const image = context.createImageData(canvas.width, canvas.height);
      for (let offset = 0; offset < image.data.length; offset += 4) {
        const value = Math.round(70 + rng.nextFloat() * 75);
        image.data[offset] = value;
        image.data[offset + 1] = value;
        image.data[offset + 2] = value;
        image.data[offset + 3] = 255;
      }
      context.putImageData(image, 0, 0);
    },
    { colorSpace: THREE.NoColorSpace },
  );
  return Object.freeze({ albedo, roughness });
}

export function createProceduralAssets({ tracker, pbr, textures, rng }) {
  if (!pbr || !textures || !rng) throw new TypeError('createProceduralAssets requires pbr, textures, and rng services.');
  const hullMaps = createHullTextures(textures);
  const nebula = textures.createValueNoise('space-nebula', 512, 256, {
    seed: rng.nextUint32(),
    octaves: 4,
    frequency: 3,
    persistence: 0.5,
  });

  const alienWidths = [1.2, 1.1, 0.8];
  const alien = ALIEN_MASKS.map((poses, caste) => Object.freeze(poses.map((mask, pose) => (
    createAlienGeometry(mask, alienWidths[caste], tracker, `alien-${caste}-pose-${pose}`)
  ))));

  const geometries = Object.freeze({
    alien: Object.freeze(alien),
    playerHull: createExtrudedShape([
      [-0.8, -0.28], [-0.58, 0.02], [-0.25, 0.13], [-0.12, 0.37],
      [0.12, 0.37], [0.25, 0.13], [0.58, 0.02], [0.8, -0.28],
    ], 0.34, tracker, 'player-hull'),
    playerRail: trackGeometry(tracker, new THREE.CylinderGeometry(0.035, 0.05, 0.52, 8), 'player-rail'),
    playerReactor: trackGeometry(tracker, new THREE.LatheGeometry([
      new THREE.Vector2(0.03, -0.16), new THREE.Vector2(0.13, -0.08),
      new THREE.Vector2(0.16, 0), new THREE.Vector2(0.1, 0.12), new THREE.Vector2(0.02, 0.18),
    ], 16), 'player-reactor'),
    saucerHull: trackGeometry(tracker, new THREE.LatheGeometry([
      new THREE.Vector2(0.08, -0.22), new THREE.Vector2(0.65, -0.13),
      new THREE.Vector2(0.82, 0), new THREE.Vector2(0.48, 0.14), new THREE.Vector2(0.16, 0.28),
    ], 24), 'saucer-hull'),
    saucerRing: trackGeometry(tracker, new THREE.TorusGeometry(0.67, 0.055, 6, 32), 'saucer-ring'),
    bunkerCell: createExtrudedShape(
      [[-0.045, -0.045], [0.045, -0.045], [0.045, 0.045], [-0.045, 0.045]],
      0.16,
      tracker,
      'bunker-cell',
      { bevelSegments: 1, bevelSize: 0.018, bevelThickness: 0.025 },
    ),
    projectilePlayer: trackGeometry(tracker, new THREE.BoxGeometry(0.055, 0.4, 0.075), 'projectile-player'),
    projectileRolling: trackGeometry(tracker, new THREE.CylinderGeometry(0.065, 0.065, 0.48, 6), 'projectile-rolling'),
    projectilePlunger: trackGeometry(tracker, new THREE.BoxGeometry(0.14, 0.46, 0.075), 'projectile-plunger'),
    projectileSquiggly: trackGeometry(tracker, new THREE.TorusGeometry(0.105, 0.027, 4, 12, Math.PI * 1.5), 'projectile-squiggly'),
    deckStrip: trackGeometry(tracker, new THREE.BoxGeometry(1, 1, 0.035), 'arena-deck-strip'),
    star: trackGeometry(tracker, new THREE.IcosahedronGeometry(0.035, 0), 'arena-star'),
    structure: trackGeometry(tracker, new THREE.BoxGeometry(1, 1, 1), 'arena-structure'),
    nebulaPlane: trackGeometry(tracker, new THREE.PlaneGeometry(1, 1), 'arena-nebula-plane'),
  });

  const materials = Object.freeze({
    playerHull: pbr.create('space-player-hull', {
      color: 0xa9cbe0, map: hullMaps.albedo, roughnessMap: hullMaps.roughness,
      emissive: 0x092633, emissiveIntensity: 0.34, metalness: 0.7, roughness: 0.34,
    }),
    playerAccent: pbr.create('space-player-accent', {
      color: 0x35e8ff, emissive: 0x25d6ef, emissiveIntensity: 2.15, metalness: 0.42, roughness: 0.24,
    }),
    alien: Object.freeze([
      pbr.create('space-alien-bottom', { color: 0x6d1e62, emissive: 0xff3fcb, emissiveIntensity: 1.25, metalness: 0.62, roughness: 0.36, vertexColors: true }),
      pbr.create('space-alien-middle', { color: 0x542267, emissive: 0xb94cff, emissiveIntensity: 1.48, metalness: 0.7, roughness: 0.31, vertexColors: true }),
      pbr.create('space-alien-top', { color: 0x4a2518, emissive: 0xb95818, emissiveIntensity: 1.15, metalness: 0.74, roughness: 0.3, vertexColors: true }),
    ]),
    bunker: pbr.create('space-bunker', { color: 0x28717b, emissive: 0x126b79, emissiveIntensity: 0.72, metalness: 0.62, roughness: 0.39, vertexColors: true }),
    projectilePlayer: pbr.create('space-projectile-player', { color: 0xc8fbff, emissive: 0x35e8ff, emissiveIntensity: 3.8, metalness: 0.15, roughness: 0.2 }),
    projectileRolling: pbr.create('space-projectile-rolling', { color: 0xffb0e8, emissive: 0xff3fcb, emissiveIntensity: 3.2, metalness: 0.15, roughness: 0.22 }),
    projectilePlunger: pbr.create('space-projectile-plunger', { color: 0xff8ea1, emissive: 0xff405f, emissiveIntensity: 3.35, metalness: 0.2, roughness: 0.2 }),
    projectileSquiggly: pbr.create('space-projectile-squiggly', { color: 0xffd391, emissive: 0xff9b31, emissiveIntensity: 3.5, metalness: 0.18, roughness: 0.22 }),
    saucerHull: pbr.create('space-saucer-hull', { color: 0x25243c, map: hullMaps.albedo, roughnessMap: hullMaps.roughness, metalness: 0.82, roughness: 0.28 }),
    saucerAccent: pbr.create('space-saucer-accent', { color: 0xffcb69, emissive: 0xffb84d, emissiveIntensity: 2.1, metalness: 0.38, roughness: 0.24 }),
    deck: pbr.create('space-deck', { color: 0x101827, emissive: 0x0a5261, emissiveIntensity: 0.42, metalness: 0.75, roughness: 0.38, vertexColors: true }),
    structure: pbr.create('space-structure', { color: 0x0c1321, emissive: 0x281441, emissiveIntensity: 0.28, metalness: 0.72, roughness: 0.44 }),
    starNear: pbr.create('space-star-near', { color: 0xe9fbff, emissive: 0xa5efff, emissiveIntensity: 1.1, metalness: 0, roughness: 0.55, vertexColors: true }),
    starMid: pbr.create('space-star-mid', { color: 0xa9dfe8, emissive: 0x579eaf, emissiveIntensity: 0.7, metalness: 0, roughness: 0.65, vertexColors: true }),
    starFar: pbr.create('space-star-far', { color: 0x776d9e, emissive: 0x4b3c78, emissiveIntensity: 0.4, metalness: 0, roughness: 0.72, vertexColors: true }),
    nebula: pbr.create('space-nebula', {
      color: 0x273357, map: nebula, emissive: 0x172348, emissiveMap: nebula,
      emissiveIntensity: 0.42, metalness: 0, roughness: 1, side: THREE.DoubleSide,
      transparent: true, opacity: 0.82, depthWrite: false,
    }),
  });

  let environmentTarget = null;
  let environmentGeneration = 0;
  const rebuildEnvironment = (renderer, abandonPrevious = false) => {
    if (!renderer?.isWebGLRenderer) throw new TypeError('rebuildEnvironment requires a WebGLRenderer.');
    if (environmentTarget) {
      tracker?.untrack(environmentTarget);
      // After context restoration the old target's GPU storage no longer
      // exists. Disposing it would run pre-restore Three.js listeners against
      // the new context and generate invalid foreign-handle deletions.
      if (!abandonPrevious) environmentTarget.dispose();
      environmentTarget = null;
    }
    const source = textures.createEnvironmentSource({ key: `space-environment-source-${environmentGeneration++}` });
    source.mapping = THREE.EquirectangularReflectionMapping;
    const generator = new THREE.PMREMGenerator(renderer);
    try {
      generator.compileEquirectangularShader();
      environmentTarget = generator.fromEquirectangular(source);
      environmentTarget.texture.name = 'space-procedural-pmrem';
      tracker?.track(environmentTarget);
      return environmentTarget.texture;
    } finally {
      textures.untrackAndDispose(source);
      generator.dispose();
    }
  };

  return Object.freeze({
    geometries,
    materials,
    textures: Object.freeze({ ...hullMaps, nebula }),
    logicalScale: 0.1,
    logicalCenterX: GAME_CONFIG.LOGICAL_WIDTH * 0.5,
    logicalCenterY: GAME_CONFIG.LOGICAL_HEIGHT * 0.5,
    rebuildEnvironment,
    get environmentTarget() { return environmentTarget; },
  });
}
