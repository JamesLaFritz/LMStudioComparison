import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { ChromaticAberrationPass } from './ChromaticAberrationPass.js';
import { FilmGrainPass } from './FilmGrainPass.js';
import { getBloomPreset } from './BloomPreset.js';

/**
 * The post-processing stack, identical in structure for every title.
 *
 * Pass order, and why it is this order:
 *
 *   1. **RenderPass**   — scene into an HDR-linear buffer.
 *   2. **UnrealBloom**  — must see *linear* HDR values. Bloom after tone
 *                         mapping would have nothing above 1.0 to bloom from.
 *   3. **Chromatic**    — a lens artefact, so it acts on the already-glowing
 *                         image the lens would actually receive.
 *   4. **FilmGrain**    — grain sits on the emulsion, i.e. after the lens.
 *   5. **SMAA**         — edge detection wants the final composited image;
 *                         running it before bloom would leave bloom to
 *                         re-introduce hard edges.
 *   6. **OutputPass**   — tone mapping and sRGB conversion, always last.
 *
 * ### On HDR render targets
 *
 * The composer is explicitly configured with `HalfFloatType`. With the default
 * 8-bit target, every value clamps at 1.0 before bloom ever runs, so a
 * material at `emissiveIntensity = 3` and one at `emissiveIntensity = 1`
 * produce *identical* bloom. All the emissive authoring in this project would
 * silently collapse into a single brightness. This one line is what makes the
 * entire lighting direction work.
 *
 * ### On tone mapping and render targets
 *
 * Three.js disables in-material tone mapping when rendering into a render
 * target, so the intermediate buffers stay linear HDR and `OutputPass` applies
 * `renderer.toneMapping` at the end. That is why `renderer.toneMapping` is set
 * on the renderer but never disabled here.
 */
export class PostFX {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {object} [opts]
   */
  constructor(renderer, scene, camera, opts = {}) {
    const {
      bloomPreset = 'spaceInvaders',
      bloomOverrides = {},
      chromatic = {},
      grain = {},
      smaa = true,
      reducedMotion = false
    } = opts;

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.reducedMotion = reducedMotion;

    const size = renderer.getSize(new THREE.Vector2());
    this.width = Math.max(1, size.x);
    this.height = Math.max(1, size.y);

    /** Divisor applied to the bloom render target. Raised by the quality tier. */
    this.bloomDivisor = 2;

    // --- Composer with an HDR-capable buffer -----------------------------
    const renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      samples: 0,
      depthBuffer: true,
      stencilBuffer: false
    });
    this.renderTarget = renderTarget;

    this.composer = new EffectComposer(renderer, renderTarget);
    this.composer.setPixelRatio(renderer.getPixelRatio());

    // --- Passes ----------------------------------------------------------
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    const preset = getBloomPreset(bloomPreset, bloomOverrides);
    this.bloomPreset = preset;
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width / this.bloomDivisor, this.height / this.bloomDivisor),
      preset.strength,
      preset.radius,
      preset.threshold
    );
    this.composer.addPass(this.bloomPass);

    this.chromaticPass = new ChromaticAberrationPass(chromatic);
    this.composer.addPass(this.chromaticPass);

    this.grainPass = new FilmGrainPass(grain);
    this.grainPass.setSize(this.width, this.height);
    this.composer.addPass(this.grainPass);

    this.smaaPass = null;
    if (smaa) {
      // SMAAPass lost its width/height arguments at r175; `addPass()` sizes it.
      this.smaaPass = new SMAAPass();
      this.composer.addPass(this.smaaPass);
    }

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    /** Decaying impact flash used in the reduced-motion path. */
    this.flash = 0;

    if (reducedMotion) this.setReducedMotion(true);
  }

  /**
   * Resize every target.
   *
   * Targets are *resized*, never recreated. Recreating them on every resize
   * event — and a window drag fires dozens per second — allocates and orphans
   * several megabytes of GPU memory per frame, which is the single most common
   * way a Three.js app develops a mysterious memory ramp.
   */
  setSize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(this.width, this.height);

    this.bloomPass.setSize(this.width / this.bloomDivisor, this.height / this.bloomDivisor);
    this.grainPass.setSize(this.width, this.height);
    if (this.smaaPass) this.smaaPass.setSize(this.width, this.height);
  }

  /** Swap the camera, e.g. when a game hands over to a cinematic rig. */
  setCamera(camera) {
    this.camera = camera;
    this.renderPass.camera = camera;
  }

  /**
   * Drive the trauma-coupled effects. Called once per frame from the game's
   * update with the current `CameraShake.trauma`.
   */
  setTrauma(trauma) {
    if (this.reducedMotion) {
      // Shake is suppressed, so the aberration would have nothing to couple to.
      // The vignette flash carries the impact information instead.
      this.flash = Math.max(this.flash, trauma);
      return;
    }
    this.chromaticPass.setTrauma(trauma);
  }

  /** Advance time-based passes on the *unscaled* clock. */
  update(unscaledDt) {
    this.grainPass.update(unscaledDt);

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - unscaledDt * 2.6);
      this.grainPass.setImpactFlash(this.flash);
    }
  }

  /**
   * Apply a quality tier from the performance governor.
   * @param {{bloomDivisor:number, grain:boolean}} tier
   */
  setQualityTier(tier) {
    if (!tier) return;

    if (tier.bloomDivisor !== this.bloomDivisor) {
      this.bloomDivisor = tier.bloomDivisor;
      this.bloomPass.setSize(this.width / this.bloomDivisor, this.height / this.bloomDivisor);
    }

    this.grainPass.setGrainEnabled(tier.grain);

    // At the lowest bloom resolution the blur pyramid is coarse enough that the
    // authored emissive values over-bloom into a white smear, so the strength
    // is pulled back to compensate.
    const strengthScale = this.bloomDivisor >= 4 ? 0.82 : 1;
    this.bloomPass.strength = this.bloomPreset.strength * strengthScale;
  }

  /**
   * Accessibility path. Chromatic aberration is disabled outright — it is a
   * motion-coupled distortion and is exactly the sort of thing the
   * `prefers-reduced-motion` signal is asking us to stop doing.
   */
  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
    this.chromaticPass.setEnabledAmount(!enabled);
    if (enabled) {
      this.grainPass.uniforms.uScanline.value *= 0.5;
    }
  }

  /** Manually tune bloom at runtime; used by the debug panel's sliders. */
  setBloom({ strength, radius, threshold }) {
    if (strength !== undefined) {
      this.bloomPreset.strength = strength;
      this.bloomPass.strength = strength;
    }
    if (radius !== undefined) {
      this.bloomPreset.radius = radius;
      this.bloomPass.radius = radius;
    }
    if (threshold !== undefined) {
      this.bloomPreset.threshold = threshold;
      this.bloomPass.threshold = threshold;
    }
  }

  render() {
    this.composer.render();
  }

  /**
   * Release every GPU resource the stack owns.
   *
   * `EffectComposer.dispose()` handles its own read/write buffers, but the
   * individual passes own additional targets — `UnrealBloomPass` allocates a
   * five-level mip pyramid, and `SMAAPass` allocates two more plus two lookup
   * textures. Each needs its own `dispose()` or the majority of the stack's
   * memory survives the teardown.
   */
  dispose() {
    this.composer.dispose();

    this.renderPass.dispose?.();
    this.bloomPass.dispose();
    this.chromaticPass.dispose?.();
    this.grainPass.dispose?.();
    if (this.smaaPass) this.smaaPass.dispose?.();
    this.outputPass.dispose?.();

    this.renderTarget.dispose();

    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.chromaticPass = null;
    this.grainPass = null;
    this.smaaPass = null;
    this.outputPass = null;
  }
}
