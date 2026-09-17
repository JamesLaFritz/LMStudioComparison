// EffectComposer stack: SceneMSAAPass → UnrealBloomPass → RetroPass → OutputPass.
// The scene is rendered into a half-float MSAA target and resolved once; the composer's own buffers
// are single-sample HDR so bloom thresholds operate on true HDR values without repeated resolves.
// Tone-mapping and sRGB conversion happen once, in OutputPass.
import { Vector2, WebGLRenderTarget, HalfFloatType, Color } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { SceneMSAAPass } from './SceneMSAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RetroShader } from './RetroShader.js';

const _size = new Vector2();
const _color = new Color();

export class PostPipeline {
  constructor(
    renderer,
    scene,
    camera,
    {
      bloom = { strength: 0.75, radius: 0.4, threshold: 0.85 },
      retro = { aberration: 0.0012, vignette: 0.38, scanlines: 0.05, grain: 0.035, vignetteColor: 0x000000 },
      samples = 4,
      aberrationTraumaGain = 0.006,
      flashDecay = 4,
    } = {},
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.time = 0;
    this.baseAberration = retro.aberration ?? 0.0012;
    this.aberrationTraumaGain = aberrationTraumaGain;
    this.flashDecay = flashDecay;
    this._flashAlpha = 0;

    renderer.getSize(_size);
    const pr = renderer.getPixelRatio();
    const width = Math.max(1, Math.floor(_size.x * pr));
    const height = Math.max(1, Math.floor(_size.y * pr));
    this.target = new WebGLRenderTarget(width, height, {
      type: HalfFloatType,
      samples: 0,
      depthBuffer: false,
      stencilBuffer: false,
    });

    this.composer = new EffectComposer(renderer, this.target);
    this.renderPass = new SceneMSAAPass(scene, camera, { width, height, samples });
    this.bloomPass = new UnrealBloomPass(
      new Vector2(_size.x, _size.y),
      bloom.strength ?? 0.75,
      bloom.radius ?? 0.4,
      bloom.threshold ?? 0.85,
    );
    this.retroPass = new ShaderPass(RetroShader);
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.retroPass);
    this.composer.addPass(this.outputPass);

    const u = this.retroPass.uniforms;
    u.uAberration.value = this.baseAberration;
    u.uVignette.value = retro.vignette ?? 0.38;
    u.uScanlines.value = retro.scanlines ?? 0.05;
    u.uGrain.value = retro.grain ?? 0.035;
    _color.set(retro.vignetteColor ?? 0x000000);
    u.uVignetteColor.value.set(_color.r, _color.g, _color.b);
    u.uResolution.value.set(_size.x * pr, _size.y * pr);
  }

  /** Uniforms of the retro pass, for games that want to drive them directly. */
  get retro() {
    return this.retroPass.uniforms;
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    const pr = this.renderer.getPixelRatio();
    this.retroPass.uniforms.uResolution.value.set(width * pr, height * pr);
  }

  setBloom({ strength, radius, threshold } = {}) {
    if (strength !== undefined) this.bloomPass.strength = strength;
    if (radius !== undefined) this.bloomPass.radius = radius;
    if (threshold !== undefined) this.bloomPass.threshold = threshold;
  }

  /** Chromatic aberration follows camera trauma; the Engine feeds this every frame. */
  setTrauma(trauma) {
    this.retroPass.uniforms.uAberration.value = this.baseAberration + trauma * this.aberrationTraumaGain;
  }

  /** Tint the vignette (e.g. toward red under pressure). `amount` blends from the base colour. */
  setVignetteTint(color, amount, baseColor = 0x000000) {
    const v = this.retroPass.uniforms.uVignetteColor.value;
    _color.set(baseColor);
    const r0 = _color.r;
    const g0 = _color.g;
    const b0 = _color.b;
    _color.set(color);
    v.set(r0 + (_color.r - r0) * amount, g0 + (_color.g - g0) * amount, b0 + (_color.b - b0) * amount);
  }

  /** Full-screen flash that decays automatically. */
  flash(color = 0xffffff, alpha = 0.6) {
    _color.set(color);
    const f = this.retroPass.uniforms.uFlash.value;
    f.set(_color.r, _color.g, _color.b, alpha);
    this._flashAlpha = alpha;
  }

  render(realDt) {
    this.time += realDt;
    const u = this.retroPass.uniforms;
    u.uTime.value = this.time;
    if (this._flashAlpha > 0) {
      this._flashAlpha = Math.max(0, this._flashAlpha - this.flashDecay * realDt);
      u.uFlash.value.w = this._flashAlpha;
    }
    this.composer.render(realDt);
  }

  dispose() {
    this.renderPass.dispose();
    this.bloomPass.dispose();
    this.retroPass.dispose();
    this.outputPass.dispose();
    this.composer.dispose();
    this.target.dispose();
  }
}
