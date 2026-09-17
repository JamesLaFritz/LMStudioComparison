import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * Shared EffectComposer stack: RenderPass -> UnrealBloomPass -> [gameCustomPasses] -> OutputPass.
 * Bloom threshold is tuned so only emissive neon materials cross it — base
 * MeshStandardMaterial albedo surfaces stay under threshold and never wash out.
 */
export class PostProcessingStack {
  constructor(renderer, scene, camera, {
    bloomStrength = 0.9,
    bloomRadius = 0.4,
    bloomThreshold = 0.82
  } = {}) {
    this._renderer = renderer;
    this._composer = new EffectComposer(renderer);

    this._renderPass = new RenderPass(scene, camera);
    this._composer.addPass(this._renderPass);

    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );
    this._composer.addPass(this._bloomPass);

    this._customPasses = [];
    this._outputPass = new OutputPass();
    this._composer.addPass(this._outputPass);
  }

  /** Insert a game-specific ShaderPass between bloom and the final output pass. */
  addCustomPass(pass) {
    this._customPasses.push(pass);
    this._composer.removePass(this._outputPass);
    this._composer.addPass(pass);
    this._composer.addPass(this._outputPass);
  }

  setBloomStrength(value) {
    this._bloomPass.strength = value;
  }

  setBloomThreshold(value) {
    this._bloomPass.threshold = value;
  }

  setSize(width, height) {
    this._composer.setSize(width, height);
    this._bloomPass.setSize(width, height);
  }

  render() {
    this._composer.render();
  }

  get composer() {
    return this._composer;
  }

  get bloomPass() {
    return this._bloomPass;
  }

  dispose() {
    this._composer.dispose();
  }
}
