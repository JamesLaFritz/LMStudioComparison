import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * CRT-style finishing pass: scanlines, vignette, subtle chromatic aberration.
 * Runs in linear space between bloom and OutputPass.
 */
const CRTShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uScanline: { value: 0.12 },
    uVignette: { value: 0.38 },
    uChroma: { value: 0.0016 },
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
    uniform float uScanline;
    uniform float uVignette;
    uniform float uChroma;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 fromCenter = uv - 0.5;
      float r2 = dot(fromCenter, fromCenter);

      // chromatic aberration, stronger toward the edges
      vec2 ca = fromCenter * uChroma * (0.5 + r2 * 3.0);
      float cr = texture2D(tDiffuse, uv - ca).r;
      vec2  cg = texture2D(tDiffuse, uv).gb;
      vec3 col = vec3(cr, cg);

      // scanlines: fine horizontal stripes, slowly drifting
      float scan = sin(uv.y * 900.0 + uTime * 2.0);
      col *= 1.0 - uScanline * 0.5 * (0.5 + 0.5 * scan);

      // vignette
      col *= 1.0 - uVignette * smoothstep(0.15, 0.75, r2);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/**
 * Build the post-processing chain:
 *   RenderPass -> UnrealBloomPass -> CRT ShaderPass -> OutputPass
 *
 * Bloom is tuned so emissive emitters (intensity 2-4) glow without washing to
 * white: threshold 0.8 keeps diffuse surfaces out, strength 0.85 keeps the
 * halo tight.
 *
 * @returns {{ composer: EffectComposer, resize: (w:number, h:number)=>void,
 *             dispose: ()=>void, bloom: UnrealBloomPass, crt: ShaderPass }}
 */
export function createPostFX(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(size.x, size.y);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.85, // strength
    0.55, // radius
    0.8   // threshold
  );
  composer.addPass(bloom);

  const crt = new ShaderPass(CRTShader);
  composer.addPass(crt);

  const output = new OutputPass();
  composer.addPass(output);

  function resize(w, h) {
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
  }

  function dispose() {
    // pass-level resources
    if (bloom.dispose) bloom.dispose();
    if (crt.dispose) crt.dispose();
    if (output.dispose) output.dispose();
    if (renderPass.dispose) renderPass.dispose();
    if (composer.dispose) composer.dispose();
  }

  return { composer, resize, dispose, bloom, crt };
}
