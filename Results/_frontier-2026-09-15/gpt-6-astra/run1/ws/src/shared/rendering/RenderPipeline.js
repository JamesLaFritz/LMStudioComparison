import {
  WebGLRenderer,
  WebGLRenderTarget,
  HalfFloatType,
  UnsignedByteType,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  Vector2,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { clamp } from "../core/math.js";
import { ResourceScope } from "../core/ResourceScope.js";
const PRESETS = {
  high: [2, 3000000, 2],
  balanced: [1.5, 2100000, 2],
  low: [1, 1000000, 0],
};
export class RenderPipeline {
  constructor({ mount, onContextLost, onContextRestored, onError }) {
    this.scope = new ResourceScope();
    this.mount = mount;
    this.quality = "balanced";
    this.width = 1;
    this.height = 1;
    this.disposed = false;
    this.lost = false;
    this.renderer = new WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x050914);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.info.autoReset = false;
    this.hdr = this.renderer.extensions.has("EXT_color_buffer_float");
    this.stats = {
      calls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
      pixelRatio: 1,
      hdr: this.hdr,
    };
    mount.prepend(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Space Invaders battlefield",
    );
    const lost = (e) => {
      e.preventDefault();
      this.lost = true;
      onContextLost?.();
      // Remove renderer listeners while old WebGL handles still belong to
      // the lost context. CPU geometry, materials and images remain reusable.
      this.disposeComposer();
      this.releaseSceneGPUResources();
    };
    const restored = () => {
      this.lost = false;
      try {
        onContextRestored?.();
      } catch (error) {
        onError?.(error);
      }
    };
    this.renderer.domElement.addEventListener("webglcontextlost", lost);
    this.renderer.domElement.addEventListener("webglcontextrestored", restored);
    this.scope.defer(() =>
      this.renderer.domElement.removeEventListener("webglcontextlost", lost),
    );
    this.scope.defer(() =>
      this.renderer.domElement.removeEventListener(
        "webglcontextrestored",
        restored,
      ),
    );
  }
  setScene(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.rebuild();
  }
  rebuild() {
    this.disposeComposer();
    const target = new WebGLRenderTarget(1, 1, {
      type: this.hdr ? HalfFloatType : UnsignedByteType,
      depthBuffer: true,
      samples: Math.min(
        PRESETS[this.quality][2],
        this.renderer.capabilities.maxSamples,
      ),
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.scenePass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(
      new Vector2(1, 1),
      this.hdr ? 0.65 : 0.4,
      0.35,
      this.hdr ? 1.1 : 0.78,
    );
    this.output = new OutputPass();
    this.composer.addPass(this.scenePass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);
    this.resize(this.width, this.height, this.quality);
  }
  resize(width, height, quality = "balanced") {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const changed = this.quality !== quality;
    this.quality = PRESETS[quality] ? quality : "balanced";
    if (changed && this.composer) {
      this.rebuild();
      return;
    }
    const preset = PRESETS[this.quality],
      max = this.renderer.capabilities.maxTextureSize;
    const ratio = clamp(
      Math.min(
        globalThis.devicePixelRatio || 1,
        preset[0],
        Math.sqrt(preset[1] / (this.width * this.height)),
        max / this.width,
        max / this.height,
      ),
      0.1,
      2,
    );
    this.stats.pixelRatio = ratio;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(this.width, this.height, false);
    if (this.composer) {
      this.composer.setPixelRatio(ratio);
      this.composer.setSize(this.width, this.height);
    }
    if (this.camera) {
      const h = Math.max(28, 36 / (this.width / this.height)),
        w = (h * this.width) / this.height;
      this.camera.left = -w / 2;
      this.camera.right = w / 2;
      this.camera.top = h / 2;
      this.camera.bottom = -h / 2;
      this.camera.updateProjectionMatrix();
    }
  }
  warmup() {
    this.renderer.compile(this.scene, this.camera);
    this.render(0);
  }
  releaseSceneGPUResources() {
    const resources = new Set();
    this.scene?.traverse((object) => {
      if (object.isInstancedMesh) resources.add(object);
      if (object.geometry) resources.add(object.geometry);
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : [];
      for (const material of materials) {
        for (const value of Object.values(material))
          if (value?.isTexture) resources.add(value);
        resources.add(material);
      }
    });
    for (const resource of resources) resource.dispose();
  }
  render(dt) {
    if (this.disposed || this.lost || !this.composer) return;
    this.renderer.info.reset();
    this.composer.render(dt);
    const info = this.renderer.info;
    this.stats.calls = info.render.calls;
    this.stats.triangles = info.render.triangles;
    this.stats.geometries = info.memory.geometries;
    this.stats.textures = info.memory.textures;
    this.stats.programs = info.programs.length;
  }
  disposeComposer() {
    if (!this.composer) return;
    this.scenePass.dispose();
    this.bloom.dispose();
    this.output.dispose();
    this.composer.dispose();
    this.composer = null;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scope.dispose();
    this.disposeComposer();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
