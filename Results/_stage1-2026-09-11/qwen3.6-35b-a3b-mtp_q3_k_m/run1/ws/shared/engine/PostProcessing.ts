import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Renderer, Scene, Camera } from 'three';

export function setupPostProcessing(
  renderer: Renderer,
  _scene: Scene,
  _camera: Camera
): EffectComposer {
  const composer = new EffectComposer(renderer);

  // Standard scene render pass
  const renderPass = new RenderPass(_scene, _camera as any);
  composer.addPass(renderPass);

  // Bloom for neon glow — tuned so emissive surfaces glow without washing out
  const bloomPass = new UnrealBloomPass(
    renderer.domElement.getBoundingClientRect(),
    0.8,   // strength: strong but controlled
    0.4,   // radius: tight bloom around bright objects
    0.2    // threshold: only truly emissive/bright surfaces trigger
  );
  composer.addPass(bloomPass);

  // Output pass for proper tonemapping
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return composer;
}
