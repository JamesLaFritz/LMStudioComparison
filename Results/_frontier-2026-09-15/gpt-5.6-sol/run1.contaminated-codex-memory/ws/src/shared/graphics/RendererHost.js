import * as THREE from 'three';
import { PostProcessPipeline } from './PostProcessPipeline.js';

const TIERS = Object.freeze(['low', 'medium', 'high']);
const QUALITY_MODES = new Set(['forced-low', 'auto', 'forced-high']);

function cssSizeForCanvas(canvas) {
  const rect = canvas.getBoundingClientRect?.();
  const width = Math.max(1, Math.round(rect?.width || canvas.clientWidth || globalThis.innerWidth || 1));
  const height = Math.max(1, Math.round(rect?.height || canvas.clientHeight || globalThis.innerHeight || 1));
  return { width, height };
}

export class RendererHost {
  constructor({
    canvas,
    scene,
    camera,
    onViewport = () => {},
    onContextLost = () => {},
    onContextRestored = () => {},
  }) {
    if (!canvas) throw new TypeError('RendererHost requires a canvas.');
    if (!scene?.isScene || !camera?.isCamera) throw new TypeError('RendererHost requires a Scene and Camera.');

    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.onViewport = onViewport;
    this.onContextLost = onContextLost;
    this.onContextRestored = onContextRestored;
    this.disposed = false;
    this.contextLost = false;
    this.qualityMode = 'auto';
    this.autoTierIndex = 1;
    this.effectiveTier = 'medium';
    this.frameEmaMs = 16.67;
    this.slowFrames = 0;
    this.fastFrames = 0;
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;
    this.contextRestoreFrame = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.previousInfoAutoReset = this.renderer.info.autoReset;
    // EffectComposer performs several renderer.render() calls for one display
    // frame. Keep their counters together so diagnostics describe the complete
    // frame rather than only OutputPass, which happens to render last.
    this.renderer.info.autoReset = false;

    const initial = cssSizeForCanvas(canvas);
    this.width = initial.width;
    this.height = initial.height;
    this.pixelRatio = this.#pixelRatioForTier(this.effectiveTier);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.pipeline = new PostProcessPipeline({
      renderer: this.renderer,
      scene,
      camera,
      width: this.width,
      height: this.height,
      effectiveTier: this.effectiveTier,
    });
    this.pipeline.resize(this.width, this.height, this.pixelRatio);

    this.boundContextLost = (event) => {
      event.preventDefault();
      if (this.contextRestoreFrame && typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(this.contextRestoreFrame);
        this.contextRestoreFrame = 0;
      }
      this.contextLost = true;
      this.pipeline.releaseGpuResourcesForContextLoss();
      this.onContextLost(event);
    };
    this.boundContextRestored = (event) => {
      this.contextLost = false;
      const finishRestore = () => {
        this.contextRestoreFrame = 0;
        if (this.disposed) return;
        try {
          // Give the browser one presentation boundary after the native restore
          // event before allocating and deleting fresh targets. Some ANGLE/D3D
          // backends otherwise still classify those handles as foreign.
          this.rebuildAfterContextRestore();
          this.onContextRestored(event);
        } catch (error) {
          this.contextLost = true;
          this.onContextRestored(event, error);
        }
      };
      this.contextRestoreFrame = typeof globalThis.requestAnimationFrame === 'function'
        ? globalThis.requestAnimationFrame(finishRestore)
        : 0;
      if (!this.contextRestoreFrame) finishRestore();
    };
    canvas.addEventListener('webglcontextlost', this.boundContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.boundContextRestored, false);

    this.resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this.resizeIfNeeded())
      : null;
    this.resizeObserver?.observe(canvas);
    if (canvas.parentElement) this.resizeObserver?.observe(canvas.parentElement);
    this.resizeIfNeeded(true);
  }

  setAnimationLoop(callback) {
    if (this.disposed && callback !== null) throw new Error('RendererHost is disposed.');
    this.renderer?.setAnimationLoop(callback);
  }

  resizeIfNeeded(force = false) {
    if (this.disposed) return false;
    const next = cssSizeForCanvas(this.canvas);
    const ratio = this.#pixelRatioForTier(this.effectiveTier);
    if (!force && next.width === this.width && next.height === this.height && ratio === this.pixelRatio) return false;

    this.width = next.width;
    this.height = next.height;
    this.pixelRatio = ratio;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(next.width, next.height, false);
    this.pipeline.resize(next.width, next.height, ratio);
    this.onViewport({
      width: next.width,
      height: next.height,
      aspect: next.width / next.height,
      pixelRatio: ratio,
      qualityMode: this.qualityMode,
      effectiveTier: this.effectiveTier,
      shadowMapSize: this.effectiveTier === 'low' ? 512 : 1024,
    });
    return true;
  }

  render(realDelta = 0) {
    if (this.disposed || this.contextLost) return;
    this.resizeIfNeeded();
    this.renderer.info.reset();
    this.pipeline.render(realDelta);
    this.#updateAdaptiveQuality(realDelta);
  }

  setQualityMode(mode) {
    if (!QUALITY_MODES.has(mode)) throw new RangeError(`Unknown quality mode "${mode}".`);
    if (this.qualityMode === mode) return false;
    this.qualityMode = mode;
    if (mode === 'forced-high') this.#applyTier('high');
    else if (mode === 'forced-low') this.#applyTier('low');
    else this.#applyTier(TIERS[this.autoTierIndex]);
    return true;
  }

  getEffectiveTier() {
    return this.effectiveTier;
  }

  rebuildAfterContextRestore() {
    if (this.disposed) return;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;
    this.pipeline.rebuildAfterContextRestore();
    this.resizeIfNeeded(true);
  }

  getRenderStats(target = {}) {
    const info = this.renderer.info;
    target.frameEmaMs = this.frameEmaMs;
    target.qualityMode = this.qualityMode;
    target.effectiveTier = this.effectiveTier;
    target.pixelRatio = this.pixelRatio;
    target.width = this.width;
    target.height = this.height;
    target.contextLost = this.contextLost;
    target.drawCalls = info.render.calls;
    target.triangles = info.render.triangles;
    target.lines = info.render.lines;
    target.points = info.render.points;
    target.programs = info.programs?.length ?? 0;
    target.geometries = info.memory.geometries;
    target.textures = info.memory.textures;
    return target;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    if (this.contextRestoreFrame && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this.contextRestoreFrame);
      this.contextRestoreFrame = 0;
    }
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.boundContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.boundContextRestored, false);
    this.pipeline.dispose();
    this.renderer.renderLists.dispose();
    this.renderer.info.autoReset = this.previousInfoAutoReset;
    this.renderer.dispose();
    if (typeof this.renderer.forceContextLoss === 'function') this.renderer.forceContextLoss();
    this.resizeObserver = null;
    this.pipeline = null;
    this.scene = null;
    this.camera = null;
    this.canvas = null;
  }

  #pixelRatioForTier(tier) {
    const deviceRatio = Number.isFinite(globalThis.devicePixelRatio) ? globalThis.devicePixelRatio : 1;
    if (tier === 'high') return Math.min(deviceRatio, 1.75);
    if (tier === 'medium') return Math.min(deviceRatio, 1.25);
    return 1;
  }

  #updateAdaptiveQuality(realDelta) {
    if (this.qualityMode !== 'auto' || !Number.isFinite(realDelta) || realDelta <= 0) return;
    const frameMs = Math.min(250, realDelta * 1000);
    this.frameEmaMs += (frameMs - this.frameEmaMs) * 0.04;
    if (this.frameEmaMs > 19) {
      this.slowFrames += 1;
      this.fastFrames = 0;
      if (this.slowFrames >= 120 && this.autoTierIndex > 0) {
        this.autoTierIndex -= 1;
        this.slowFrames = 0;
        this.#applyTier(TIERS[this.autoTierIndex]);
      }
    } else if (this.frameEmaMs < 14) {
      this.fastFrames += 1;
      this.slowFrames = 0;
      if (this.fastFrames >= 300 && this.autoTierIndex < TIERS.length - 1) {
        this.autoTierIndex += 1;
        this.fastFrames = 0;
        this.#applyTier(TIERS[this.autoTierIndex]);
      }
    } else {
      this.slowFrames = 0;
      this.fastFrames = 0;
    }
  }

  #applyTier(tier) {
    if (tier === this.effectiveTier) return;
    this.effectiveTier = tier;
    this.pipeline.setEffectiveTier(tier);
    this.resizeIfNeeded(true);
  }
}
