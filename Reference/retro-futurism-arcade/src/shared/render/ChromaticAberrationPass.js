import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Radial chromatic aberration, coupled to camera trauma.
 *
 * The effect samples the red and blue channels at slightly different radial
 * offsets from screen centre, simulating lateral chromatic aberration in a
 * real lens. Two details make it read as a lens rather than as a glitch
 * filter:
 *
 *  1. **The offset scales with distance from centre**, quadratically. A real
 *     lens is corrected at the optical axis and worst at the edges, so a
 *     uniform offset immediately looks wrong.
 *  2. **It is nearly zero at rest.** The base offset is 0.0012 — perceptible
 *     only as a slight richness at the frame edges. It spikes to ~0.007 under
 *     trauma, which is what sells an impact.
 *
 * A three-tap version is used rather than a full spectral sweep because at
 * these magnitudes the extra taps are indistinguishable and cost real time on
 * a full-screen pass.
 */
export const ChromaticAberrationShader = {
  name: 'ChromaticAberrationShader',

  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0.0012 },
    uFalloff: { value: 2.0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) }
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
    uniform float uAmount;
    uniform float uFalloff;
    uniform vec2  uCenter;

    varying vec2 vUv;

    void main() {
      vec2 toCenter = vUv - uCenter;
      float dist = length(toCenter);

      // Quadratic (or steeper) falloff: corrected at the axis, worst at the
      // edges. Normalised against 0.7071 so the corner reaches full strength.
      float weight = pow(dist / 0.7071, uFalloff);
      vec2 dir = dist > 0.0001 ? toCenter / dist : vec2(0.0);
      vec2 offset = dir * uAmount * weight;

      // Red pulled outward, blue pulled inward, green left at the true
      // position so the image never appears to shift as a whole.
      float r = texture2D(tDiffuse, vUv + offset).r;
      vec4  g = texture2D(tDiffuse, vUv);
      float b = texture2D(tDiffuse, vUv - offset).b;

      gl_FragColor = vec4(r, g.g, b, g.a);
    }
  `
};

export class ChromaticAberrationPass extends ShaderPass {
  /**
   * @param {object} [opts]
   * @param {number} [opts.base]  offset at rest, in UV units
   * @param {number} [opts.peak]  additional offset at trauma = 1
   */
  constructor({ base = 0.0012, peak = 0.0055, falloff = 2.0 } = {}) {
    super(ChromaticAberrationShader);
    this.base = base;
    this.peak = peak;
    this.uniforms.uAmount.value = base;
    this.uniforms.uFalloff.value = falloff;
  }

  /**
   * Drive the effect from camera trauma.
   *
   * Trauma is squared before use — the same curve the camera shake itself
   * uses — so that the aberration and the shake ramp together. Driving one
   * linearly and the other quadratically makes them feel like two unrelated
   * effects happening at the same time.
   *
   * @param {number} trauma 0..1
   */
  setTrauma(trauma) {
    const t = trauma < 0 ? 0 : trauma > 1 ? 1 : trauma;
    this.uniforms.uAmount.value = this.base + this.peak * t * t;
  }

  /** Disable entirely, for the reduced-motion path. */
  setEnabledAmount(enabled) {
    this.enabled = enabled;
    if (!enabled) this.uniforms.uAmount.value = 0;
  }
}
