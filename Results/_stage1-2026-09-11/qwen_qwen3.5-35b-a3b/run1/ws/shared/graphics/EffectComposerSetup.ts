import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export class EffectComposerSetup {
  private composer: any;
  private renderer: any;
  private scene: any;
  private camera: any;
  private bloomPass: any;

  constructor(renderer: any, scene: any, camera: any) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    
    // Initialize composer with render pass
    this.composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Configure bloom for retro-futurism glow
    this.bloomPass = new UnrealBloomPass(
      new (window as any).Vector2(window.innerWidth, window.innerHeight),
      1.5,   // strength: moderate glow without washing out
      0.4,   // radius: soft bloom spread
      0.85   // threshold: only bright emissive surfaces trigger bloom
    );
    this.composer.addPass(this.bloomPass);

    // Optional color grading for warm retro look
    const colorGradingShader = {
      name: 'ColorGrading',
      uniforms: {
        tDiffuse: { value: null },
        gradeAmount: { value: 0.02 },
        tint: { value: new (window as any).Vector3(1.1, 1.05, 0.9) } // warm tint
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float gradeAmount;
        uniform vec3 tint;
        uniform sampler2D tDiffuse;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          // Apply warm tint with subtle saturation boost
          color.rgb = mix(color.rgb, color.rgb * tint, gradeAmount);
          gl_FragColor = color;
        }
      `
    };

    const colorGradingPass = new ShaderPass(colorGradingShader as any);
    this.composer.addPass(colorGradingPass);
  }

  public render(): void {
    this.composer.render();
  }

  public resize(width: number, height: number): void {
    if (this.bloomPass) {
      this.bloomPass.setSize(width, height);
    }
    // Resize all passes in composer
    for (const pass of this.composer.passes) {
      if ('setSize' in pass && typeof pass.setSize === 'function') {
        pass.setSize(width, height);
      }
    }
  }

  public getComposer(): any {
    return this.composer;
  }

  public setBloomStrength(value: number): void {
    if (this.bloomPass) {
      this.bloomPass.strength = value;
    }
  }

  public setBloomRadius(value: number): void {
    if (this.bloomPass) {
      this.bloomPass.radius = value;
    }
  }

  public setBloomThreshold(value: number): void {
    if (this.bloomPass) {
      this.bloomPass.threshold = value;
    }
  }
}