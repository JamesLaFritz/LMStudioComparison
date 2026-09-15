import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// CRT Scanline + Chromatic Aberration shader
const ScanlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      
      // Scanlines
      float scanline = sin(uv.y * 800.0) * 0.04;
      
      // Chromatic aberration at edges
      float dist = distance(uv, vec2(0.5));
      float caStrength = max(0.0, (dist - 0.3) * 0.5);
      vec2 caOffset = vec2(caStrength * 0.003, 0.0);
      
      float r = texture2D(tDiffuse, uv + caOffset).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - caOffset).b;
      
      vec3 color = vec3(r, g, b);
      color -= scanline;
      
      // Vignette
      float vignette = 1.0 - dist * 0.8;
      color *= vignette;
      
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class PostProcessingStack {
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scanlinePass: ShaderPass | null = null;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.init();
  }

  private init(): void {
    this.composer = new EffectComposer(this.renderer);
    
    // Render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Bloom pass - tuned for neon retro-futurism
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.renderer.domElement.width, this.renderer.domElement.height),
      1.2,   // strength
      0.5,   // radius
      0.2    // threshold
    );
    this.composer.addPass(this.bloomPass);

    // Scanline + chromatic aberration pass
    this.scanlinePass = new ShaderPass(ScanlineShader);
    this.composer.addPass(this.scanlinePass);
  }

  update(time: number): void {
    if (this.scanlinePass) {
      (this.scanlinePass.uniforms as any).time.value = time;
    }
  }

  render(): void {
    if (this.composer) {
      this.composer.render();
    }
  }

  setSize(width: number, height: number): void {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  }

  dispose(): void {
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    this.bloomPass = null;
    this.scanlinePass = null;
  }
}