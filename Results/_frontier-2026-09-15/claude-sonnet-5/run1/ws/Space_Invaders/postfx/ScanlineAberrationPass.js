import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  uniform float uAberrationStrength;
  uniform float uScanlineStrength;
  uniform float uVignetteStrength;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv - 0.5;
    float dist = length(centered);

    vec2 aberrationOffset = uAberrationStrength * centered * dist;
    float r = texture2D(tDiffuse, vUv - aberrationOffset).r;
    float g = texture2D(tDiffuse, vUv).g;
    float b = texture2D(tDiffuse, vUv + aberrationOffset).b;

    float scanline = 1.0 - uScanlineStrength * abs(sin(vUv.y * uResolution.y * 3.14159));
    vec3 color = vec3(r, g, b) * scanline;

    float vignette = 1.0 - uVignetteStrength * dist * dist;
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Custom CRT-flavored post pass: subtle chromatic aberration that grows
 * toward screen edges, scanline darkening, and a soft vignette. Inserted
 * between the bloom pass and the final OutputPass.
 */
export class ScanlineAberrationPass extends Pass {
  constructor(width, height, {
    aberrationStrength = 0.0015,
    scanlineStrength = 0.08,
    vignetteStrength = 0.35
  } = {}) {
    super();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(width, height) },
        uAberrationStrength: { value: aberrationStrength },
        uScanlineStrength: { value: scanlineStrength },
        uVignetteStrength: { value: vignetteStrength }
      },
      vertexShader,
      fragmentShader
    });

    this.fsQuad = new FullScreenQuad(this.material);
  }

  setSize(width, height) {
    this.material.uniforms.uResolution.value.set(width, height);
  }

  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }

    this.fsQuad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
