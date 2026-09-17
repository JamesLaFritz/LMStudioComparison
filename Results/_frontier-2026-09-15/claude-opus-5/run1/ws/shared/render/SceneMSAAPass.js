// Renders the scene into a private multisampled HDR target and resolves it once into the
// composer's (single-sample) write buffer. Post passes then run on plain textures, so the
// expensive MSAA resolve happens exactly one time per frame instead of once per pass.
import { WebGLRenderTarget, HalfFloatType, ShaderMaterial, UniformsUtils } from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';

export class SceneMSAAPass extends Pass {
  constructor(scene, camera, { width, height, samples = 4, clearColor = null, clearAlpha = 1 } = {}) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.clearColor = clearColor;
    this.clearAlpha = clearAlpha;
    this.needsSwap = true;

    this.target = new WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
      type: HalfFloatType,
      samples,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.target.texture.name = 'SceneMSAAPass.hdr';

    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.clone(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.material.uniforms.tDiffuse.value = this.target.texture;
    this.quad = new FullScreenQuad(this.material);
  }

  setSize(width, height) {
    this.target.setSize(Math.max(1, width), Math.max(1, height));
  }

  render(renderer, writeBuffer) {
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.setRenderTarget(this.target);
    if (this.clearColor !== null) renderer.setClearColor(this.clearColor, this.clearAlpha);
    renderer.clear(true, true, false);
    renderer.render(this.scene, this.camera);

    // Resolve: sampling the multisampled texture triggers the single blit; copy into the chain.
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    renderer.clear(true, false, false);
    this.quad.render(renderer);

    renderer.autoClear = oldAutoClear;
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.quad.dispose();
  }
}
