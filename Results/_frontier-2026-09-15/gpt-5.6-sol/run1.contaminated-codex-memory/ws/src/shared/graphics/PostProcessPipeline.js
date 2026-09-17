import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VALID_TIERS = new Set(['high', 'medium', 'low']);

function sampleCountForTier(tier, renderer) {
  if (renderer.capabilities?.isWebGL2 === false) return 0;
  const desired = tier === 'high' ? 4 : tier === 'medium' ? 2 : 0;
  if (desired === 0) return 0;
  return (renderer.capabilities?.maxSamples ?? 0) >= desired ? desired : 0;
}

export class PostProcessPipeline {
  constructor({
    renderer,
    scene,
    camera,
    width = 1,
    height = 1,
    effectiveTier = 'medium',
  }) {
    if (!renderer?.isWebGLRenderer) throw new TypeError('PostProcessPipeline requires a WebGLRenderer.');
    if (!scene?.isScene) throw new TypeError('PostProcessPipeline requires a Scene.');
    if (!camera?.isCamera) throw new TypeError('PostProcessPipeline requires a Camera.');

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.pixelRatio = Math.max(0.5, renderer.getPixelRatio?.() || 1);
    this.effectiveTier = VALID_TIERS.has(effectiveTier) ? effectiveTier : 'medium';
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.outputPass = null;
    this.disposed = false;
    this.#build();
  }

  render(realDelta = 0) {
    this.#assertUsable();
    this.composer.render(Math.max(0, Number.isFinite(realDelta) ? realDelta : 0));
  }

  resize(width, height, pixelRatio = this.pixelRatio) {
    this.#assertUsable();
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    const nextRatio = Math.max(0.5, Math.min(3, Number.isFinite(pixelRatio) ? pixelRatio : 1));
    if (nextWidth === this.width && nextHeight === this.height && nextRatio === this.pixelRatio) return false;

    this.width = nextWidth;
    this.height = nextHeight;
    this.pixelRatio = nextRatio;
    this.composer.setPixelRatio(nextRatio);
    this.composer.setSize(nextWidth, nextHeight);
    return true;
  }

  setEffectiveTier(tier) {
    this.#assertUsable();
    if (!VALID_TIERS.has(tier)) throw new RangeError(`Unknown post-process tier "${tier}".`);
    if (tier === this.effectiveTier) return false;
    const oldSamples = sampleCountForTier(this.effectiveTier, this.renderer);
    const nextSamples = sampleCountForTier(tier, this.renderer);
    this.effectiveTier = tier;
    if (oldSamples !== nextSamples) this.#rebuildComposer();
    return true;
  }

  releaseGpuResourcesForContextLoss() {
    this.#assertUsable();
    // Disposal events remove renderer-manager listeners while the underlying
    // context is already lost, so no stale framebuffer, texture, or fullscreen
    // geometry handles survive into the restored context.
    this.#disposeComposer();
  }

  rebuildAfterContextRestore() {
    this.#assertUsable();
    // The prior context has already destroyed its GPU objects. Calling
    // dispose() here invokes listeners owned by Three's pre-restore WebGL
    // managers and asks the restored context to delete foreign handles.
    // Abandon the stale composer graph and build a fresh one instead; the old
    // JavaScript graph is unreachable and its GPU allocations no longer exist.
    this.#abandonComposer();
    this.#build();
  }

  dispose() {
    if (this.disposed) return;
    this.#disposeComposer();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.disposed = true;
  }

  #build() {
    const physicalWidth = Math.max(1, Math.floor(this.width * this.pixelRatio));
    const physicalHeight = Math.max(1, Math.floor(this.height * this.pixelRatio));
    const renderTarget = new THREE.WebGLRenderTarget(physicalWidth, physicalHeight, {
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
      samples: sampleCountForTier(this.effectiveTier, this.renderer),
    });
    renderTarget.texture.name = 'PostProcessPipeline.primary';

    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.width, this.height);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(physicalWidth, physicalHeight),
      0.85,
      0.32,
      0.9,
    );
    this.bloomPass.strength = 0.85;
    this.bloomPass.radius = 0.32;
    this.bloomPass.threshold = 0.9;
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
    this.#assertPassOrder();
  }

  #rebuildComposer() {
    this.#disposeComposer();
    this.#build();
  }

  #disposeComposer() {
    if (!this.composer) return;
    for (const pass of [this.renderPass, this.bloomPass, this.outputPass]) {
      if (pass && typeof pass.dispose === 'function') pass.dispose();
    }
    this.composer.dispose();
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.outputPass = null;
  }

  #abandonComposer() {
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.outputPass = null;
  }

  #assertPassOrder() {
    const passes = this.composer.passes;
    if (passes.length !== 3 || passes[0] !== this.renderPass || passes[1] !== this.bloomPass || passes[2] !== this.outputPass) {
      throw new Error('Post-processing order must be RenderPass -> UnrealBloomPass -> OutputPass.');
    }
  }

  #assertUsable() {
    if (this.disposed) throw new Error('PostProcessPipeline is disposed.');
  }
}
