import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Combined film grain, scanline and vignette pass.
 *
 * These three effects are merged into one pass on purpose. Each is a couple of
 * ALU operations, but each as a separate `ShaderPass` costs a full-screen
 * texture read and write plus a render-target swap. On a 4K display that is
 * three times the bandwidth for the same result.
 *
 * Design notes:
 *
 *  - **Grain is applied in a signed, luminance-preserving way** and scaled down
 *    in the highlights. Uniform additive grain crushes the blacks and makes the
 *    bloomed neon look dirty; weighting by `1 - luma` keeps the glow clean and
 *    puts the texture in the shadows where film actually has it.
 *  - **Scanlines are subtle and resolution-independent.** The line count is
 *    fixed in screen space rather than derived from pixel height, so the CRT
 *    read is identical on a 1080p laptop and a 1440p ultrawide.
 *  - **The vignette is applied last** so it darkens the grain too, rather than
 *    leaving a ring of visible noise in the corners.
 */
export const FilmGrainShader = {
  name: 'FilmGrainShader',

  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.045 },
    uScanline: { value: 0.055 },
    uScanlineCount: { value: 900 },
    uVignette: { value: 0.55 },
    uResolution: { value: new THREE.Vector2(1, 1) }
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uScanline;
    uniform float uScanlineCount;
    uniform float uVignette;
    uniform vec2  uResolution;

    varying vec2 vUv;

    // Integer-hash noise. Deliberately not a sin-based hash: sin(dot(...))
    // hashing has visible periodic structure on some mobile GPUs where the
    // trig precision is lower, which shows up as a diagonal moire in the grain.
    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

      // --- Grain -------------------------------------------------------
      // Sampled in pixel space so grain size is one pixel regardless of
      // resolution, and offset by time so it resolves rather than crawling.
      vec2 grainCoord = vUv * uResolution + vec2(uTime * 137.0, uTime * 91.0);
      float noise = hash12(floor(grainCoord)) - 0.5;

      // Weight toward the shadows. Highlights stay clean so bloom reads pure.
      float grainWeight = uGrain * (1.0 - luma * 0.75);
      color.rgb += noise * grainWeight;

      // --- Scanlines ---------------------------------------------------
      // Cosine rather than a hard step: a hard step aliases badly when the
      // line frequency approaches the pixel frequency.
      float scan = cos(vUv.y * uScanlineCount * 3.14159265) * 0.5 + 0.5;
      color.rgb *= 1.0 - uScanline * scan;

      // --- Vignette ----------------------------------------------------
      vec2 fromCenter = vUv - 0.5;
      float vig = 1.0 - uVignette * dot(fromCenter, fromCenter) * 2.2;
      color.rgb *= clamp(vig, 0.0, 1.0);

      gl_FragColor = color;
    }
  `
};

export class FilmGrainPass extends ShaderPass {
  constructor({
    grain = 0.045,
    scanline = 0.055,
    scanlineCount = 900,
    vignette = 0.55
  } = {}) {
    super(FilmGrainShader);
    this.uniforms.uGrain.value = grain;
    this.uniforms.uScanline.value = scanline;
    this.uniforms.uScanlineCount.value = scanlineCount;
    this.uniforms.uVignette.value = vignette;

    this.baseGrain = grain;
    this.baseVignette = vignette;
    this._time = 0;
  }

  /**
   * Advance the grain animation.
   *
   * Driven by unscaled time on purpose. During hit-stop the world freezes but
   * the grain keeps moving, which is what stops a freeze frame from looking
   * like the game has crashed.
   */
  update(unscaledDt) {
    this._time += unscaledDt;
    // Wrap to keep float precision high after long sessions.
    if (this._time > 1000) this._time -= 1000;
    this.uniforms.uTime.value = this._time;
  }

  setSize(width, height) {
    this.uniforms.uResolution.value.set(width, height);
  }

  /**
   * Vignette flash used as the reduced-motion substitute for camera shake.
   * Conveys the same "you were hit" information without moving the viewport.
   */
  setImpactFlash(amount) {
    this.uniforms.uVignette.value = this.baseVignette + amount * 0.55;
  }

  /** Disable grain and scanlines but keep the vignette. */
  setGrainEnabled(enabled) {
    this.uniforms.uGrain.value = enabled ? this.baseGrain : 0;
    this.uniforms.uScanline.value = enabled ? 0.055 : 0;
  }
}
