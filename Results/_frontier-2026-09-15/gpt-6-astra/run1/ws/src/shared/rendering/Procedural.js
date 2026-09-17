import {
  Shape,
  ExtrudeGeometry,
  CanvasTexture,
  SRGBColorSpace,
  EquirectangularReflectionMapping,
  RepeatWrapping,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SeededRandom } from "../core/SeededRandom.js";
export function makeBeveledBox(w, h, d, bevel = 0.02) {
  const b = Math.min(bevel, w / 4, h / 4, d / 4),
    x = w / 2 - b,
    y = h / 2 - b;
  const shape = new Shape();
  shape.moveTo(-x, -y);
  shape.lineTo(x, -y);
  shape.lineTo(x, y);
  shape.lineTo(-x, y);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: d - 2 * b,
    bevelEnabled: b > 0,
    bevelSegments: 1,
    steps: 1,
    bevelSize: b,
    bevelThickness: b,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -(d - 2 * b) / 2);
  return geometry;
}
export function mergeOwned(parts) {
  if (!parts.length) throw new Error("Cannot merge empty geometry");
  let merged;
  try {
    merged = mergeGeometries(parts, false);
    if (!merged) throw new Error("Incompatible procedural geometry");
  } finally {
    for (const g of parts) g.dispose();
  }
  merged.computeBoundingSphere();
  return merged;
}
export function makePanelTextures(seed, size = 512) {
  const rng = new SeededRandom(seed),
    canvas = document.createElement("canvas"),
    roughCanvas = document.createElement("canvas");
  canvas.width = canvas.height = roughCanvas.width = roughCanvas.height = size;
  const ctx = canvas.getContext("2d"),
    rctx = roughCanvas.getContext("2d");
  ctx.fillStyle = "#081221";
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 16)
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = `rgba(60,95,125,${rng.range(0.005, 0.04)})`;
      ctx.fillRect(x, y, 15, 15);
    }
  ctx.lineWidth = 0.55;
  ctx.strokeStyle = "rgba(83,138,163,.22)";
  ctx.beginPath();
  for (let i = 0; i <= size; i += 32) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(116,180,193,.3)";
  for (let x = 0; x < size; x += 64)
    for (let y = 0; y < size; y += 64) ctx.fillRect(x - 1, y - 1, 2, 2);
  const data = rctx.createImageData(size, size),
    phase = rng.range(0, 6.28);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n =
        Math.sin(x * 0.11 + phase) * Math.sin(y * 0.13) +
        0.5 * Math.sin(x * 0.22) * Math.sin(y * 0.26 + phase) +
        0.25 * Math.sin(x * 0.44 + phase) * Math.sin(y * 0.52);
      const v = 150 + Math.round(n * 12),
        i = (y * size + x) * 4;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
  rctx.putImageData(data, 0, 0);
  const color = new CanvasTexture(canvas);
  color.colorSpace = SRGBColorSpace;
  color.wrapS = color.wrapT = RepeatWrapping;
  color.repeat.set(2, 2);
  const roughness = new CanvasTexture(roughCanvas);
  roughness.wrapS = roughness.wrapT = RepeatWrapping;
  roughness.repeat.set(2, 2);
  return { color, roughness };
}
export function makeEnvironmentTexture(seed, width = 1024, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d"),
    rng = new SeededRandom(seed);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#7595bb");
  gradient.addColorStop(0.4, "#20324c");
  gradient.addColorStop(0.55, "#080f20");
  gradient.addColorStop(1, "#141928");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 6; i++) {
    const x = rng.range(0, width),
      y = rng.range(0, height * 0.6),
      g = ctx.createRadialGradient(x, y, 1, x, y, 110);
    g.addColorStop(0, i % 2 ? "rgba(125,246,255,.65)" : "rgba(210,138,255,.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 110, y - 110, 220, 220);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.mapping = EquirectangularReflectionMapping;
  return texture;
}
