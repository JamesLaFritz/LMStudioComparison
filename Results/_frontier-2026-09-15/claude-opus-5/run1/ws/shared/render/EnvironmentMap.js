// Procedural image-based-lighting environment. PBR metals are black without something to reflect,
// so we render a tiny neon "studio" (gradient sky sphere + emissive light bars) through a
// PMREMGenerator once at startup. Everything here is MeshStandardMaterial and Canvas-generated.
import {
  Scene,
  Mesh,
  SphereGeometry,
  BoxGeometry,
  MeshStandardMaterial,
  CanvasTexture,
  SRGBColorSpace,
  BackSide,
  Color,
  PMREMGenerator,
} from 'three';

function makeSkyGradient({ top, upper, horizon, bottom }) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, top);
  g.addColorStop(0.42, upper);
  g.addColorStop(0.55, horizon);
  g.addColorStop(0.62, bottom);
  g.addColorStop(1.0, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Build the environment and return { texture, dispose }. The caller assigns `scene.environment`.
 * @param {import('three').WebGLRenderer} renderer
 */
export function createNeonEnvironment(
  renderer,
  {
    top = '#0a0d24',
    upper = '#1c2a5c',
    horizon = '#ff2bd6',
    bottom = '#05060f',
    bars = [
      { position: [0, 18, 0], size: [30, 1, 8], color: 0xcfe8ff, intensity: 4 },
      { position: [-20, 6, -10], size: [1, 10, 24], color: 0xff2bd6, intensity: 3 },
      { position: [20, 6, -10], size: [1, 10, 24], color: 0x19f0ff, intensity: 3 },
      { position: [0, 4, 24], size: [24, 6, 1], color: 0x9b5cff, intensity: 1.5 },
    ],
  } = {},
) {
  const scene = new Scene();
  const skyTexture = makeSkyGradient({ top, upper, horizon, bottom });
  const skyGeometry = new SphereGeometry(60, 32, 16);
  const skyMaterial = new MeshStandardMaterial({
    color: new Color(0x000000),
    emissive: new Color(0xffffff),
    emissiveMap: skyTexture,
    emissiveIntensity: 1,
    side: BackSide,
    roughness: 1,
    metalness: 0,
  });
  scene.add(new Mesh(skyGeometry, skyMaterial));

  const barGeometries = [];
  const barMaterials = [];
  for (const bar of bars) {
    const geometry = new BoxGeometry(bar.size[0], bar.size[1], bar.size[2]);
    const material = new MeshStandardMaterial({
      color: new Color(0x000000),
      emissive: new Color(bar.color),
      emissiveIntensity: bar.intensity,
      roughness: 1,
      metalness: 0,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.set(bar.position[0], bar.position[1], bar.position[2]);
    scene.add(mesh);
    barGeometries.push(geometry);
    barMaterials.push(material);
  }

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.04);
  pmrem.dispose();

  // The source scene is no longer needed once the prefiltered map exists.
  skyGeometry.dispose();
  skyMaterial.dispose();
  skyTexture.dispose();
  for (const g of barGeometries) g.dispose();
  for (const m of barMaterials) m.dispose();

  return {
    texture: target.texture,
    dispose() {
      target.dispose();
    },
  };
}
