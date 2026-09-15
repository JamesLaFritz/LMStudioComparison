import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Vector2 } from 'three';

export function createComposer(renderer, width, height, bloomConfig = {}) {
  const composer = new EffectComposer(renderer);

  const renderPass = new RenderPass();
  composer.addPass(renderPass);

  const {
    strength = 0.6,
    radius = 0.4,
    threshold = 0.85,
  } = bloomConfig;

  const bloomPass = new UnrealBloomPass(
    new Vector2(width, height),
    strength,
    radius,
    threshold
  );
  composer.addPass(bloomPass);

  composer.setSize(width, height);

  return { composer, renderPass, bloomPass };
}
