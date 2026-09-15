import * as THREE from 'three';

const CANVAS = document.createElement('canvas');
CANVAS.width = 256;
CANVAS.height = 256;
const ctx = CANVAS.getContext('2d');

function createNeonTexture(color1, color2) {
  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.7 ? color1 : color2;
    ctx.fillRect(x, y, 4, 4);
  }
  return new THREE.CanvasTexture(CANVAS) { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
}

export const INVADER_TEXTURE = createNeonTexture('#ff0055', '#2a1d3b');
export const LASER_TEXTURE = createNeonTexture('#ffffff', '#88ccff');
export const STARFIELD_TEXTURE = createNeonTexture('#4c699e', '#1a2a4a');

function makeNoiseGeometry(segments, amplitude) {
  const positions = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    positions[i * 3] = Math.sin((i + 15) / 7) * amplitude;
    positions[i * 3 + 1] = Math.cos((i + 24) / 8) * amplitude;
    positions[i * 3 + 2] = (Math.random() - 0.5) * amplitude;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}
}

export function disposeAssets(assets) {
  for (const asset of assets) {
    if (asset instanceof THREE.WebGLTexture) asset.dispose();
    if (asset instanceof THREE.WebGLBuffer) asset.dispose();
    if (asset instanceof THREE.Material) asset.dispose();
  }
}