// WebGLRenderer configured for an HDR post-processing pipeline: linear rendering into a
// half-float target, tone-mapping + sRGB applied once in the OutputPass.
import { WebGLRenderer, SRGBColorSpace, ACESFilmicToneMapping, Color } from 'three';

export function createRenderer({ container, pixelRatioCap = 2, clearColor = 0x05060f, antialias = false } = {}) {
  const renderer = new WebGLRenderer({
    antialias,
    powerPreference: 'high-performance',
    stencil: false,
    alpha: false,
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(new Color(clearColor), 1);
  renderer.autoClear = true;
  renderer.domElement.classList.add('game-canvas');
  renderer.domElement.tabIndex = -1;
  container.appendChild(renderer.domElement);
  return renderer;
}
