import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 1.2 },
    offset: { value: 1.1 }
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
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * 2.0;
      float vig = 1.0 - dot(uv, uv);
      vig = clamp(pow(vig * darkness + offset - 1.0, 1.5), 0.0, 1.0);
      gl_FragColor = vec4(texel.rgb * vig, texel.a);
    }
  `
};

export class PostProcessing {
  constructor(renderer) {
    this.composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(null, null);
    this.composer.addPass(renderPass);
    this.renderPass = renderPass;

    this.bloomPass = new UnrealBloomPass(
      renderer.domElement.getBoundingClientRect(),
      1.5,   // strength
      0.5,   // radius
      0.7    // threshold
    );
    this.composer.addPass(this.bloomPass);

    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms.darkness.value = 1.4;
    vignettePass.uniforms.offset.value = 1.2;
    this.vignettePass = vignettePass;
    this.composer.addPass(vignettePass);
  }

  setScene(scene) {
    if (this.renderPass) this.renderPass.scene = scene;
  }

  setCamera(camera) {
    if (this.renderPass) this.renderPass.camera = camera;
  }

  init(scene, camera) {
    this.setScene(scene);
    this.setCamera(camera);
  }

  render() {
    this.composer.render();
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
  }

  update(dt) {
    // Update bloom intensity based on game state if needed
    // Currently just a pass-through for future extensibility
  }

  dispose() {
    this.composer.dispose();
  }
}
