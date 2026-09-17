import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createPostFX({
  renderer,
  scene,
  camera,
  width,
  height,
  pixelRatio = 1,
  bloom = {},
} = {}) {
  if (!renderer || !scene || !camera) throw new TypeError('PostFX requires renderer, scene, and camera.');
  const target = createRenderTarget(renderer, width, height, pixelRatio);
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width * pixelRatio, height * pixelRatio),
    bloom.strength ?? 0.9,
    bloom.radius ?? 0.32,
    bloom.threshold ?? 0.85,
  );
  bloomPass.threshold = bloom.threshold ?? 0.85;
  bloomPass.strength = bloom.strength ?? 0.9;
  bloomPass.radius = bloom.radius ?? 0.32;
  const smaaPass = new SMAAPass(width * pixelRatio, height * pixelRatio);
  const outputPass = new OutputPass();

  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(smaaPass);
  composer.addPass(outputPass);

  let disposed = false;
  return {
    composer,
    renderPass,
    bloomPass,
    smaaPass,
    outputPass,
    render(deltaTime) {
      if (!disposed) composer.render(deltaTime);
    },
    resize(nextWidth, nextHeight, nextPixelRatio = pixelRatio) {
      if (disposed) return;
      pixelRatio = nextPixelRatio;
      composer.setPixelRatio(pixelRatio);
      composer.setSize(nextWidth, nextHeight);
      bloomPass.setSize(nextWidth * pixelRatio, nextHeight * pixelRatio);
      smaaPass.setSize(nextWidth * pixelRatio, nextHeight * pixelRatio);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderPass.dispose?.();
      bloomPass.dispose?.();
      smaaPass.dispose?.();
      outputPass.dispose?.();
      composer.dispose?.();
    },
  };
}

function createRenderTarget(renderer, width, height, pixelRatio) {
  const supportsHalfFloat = Boolean(
    renderer.capabilities?.isWebGL2
    || renderer.extensions?.has?.('EXT_color_buffer_float')
    || renderer.extensions?.has?.('EXT_color_buffer_half_float'),
  );
  return new THREE.WebGLRenderTarget(
    Math.max(1, Math.floor(width * pixelRatio)),
    Math.max(1, Math.floor(height * pixelRatio)),
    {
      type: supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    },
  );
}
