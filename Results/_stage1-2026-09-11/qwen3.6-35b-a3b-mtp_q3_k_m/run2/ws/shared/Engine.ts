import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect } from 'postprocessing';

export interface EngineConfig {
  containerId: string;
  width?: number;
  height?: number;
}

export class Engine {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly composer: EffectComposer;
  public readonly clock: THREE.Clock = new THREE.Clock();
  public deltaTime: number = 0;

  private bloomEffect: BloomEffect;
  private effectPass: EffectPass;
  private animationId: number | null = null;
  private onFrameCallback: ((delta: number) => void) | null = null;
  private resizeHandler: (() => void) | null = null;

  constructor(config: EngineConfig) {
    const width = config.width ?? window.innerWidth;
    const height = config.height ?? window.innerHeight;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    const container = document.getElementById(config.containerId);
    if (!container) {
      throw new Error(`Container #${config.containerId} not found`);
    }
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050510);
    this.scene.fog = new THREE.FogExp2(0x050510, 0.015);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200);
    this.camera.position.set(0, 8, 18);
    this.camera.lookAt(0, 0, 0);

    // Post-processing: EffectComposer v6 API
    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Bloom effect — strength/intensity=1.2, radius=0.4, threshold=0.85
    this.bloomEffect = new BloomEffect({
      intensity: 1.2,
      kernelSize: 64,
      resolutionX: width >> 1,
      resolutionY: height >> 1,
      luminanceThreshold: 0.85,
      luminanceSmoothing: 0.4,
    });

    this.effectPass = new EffectPass(this.camera, this.bloomEffect);
    this.composer.addPass(this.effectPass);

    // Resize handler
    this.resizeHandler = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
    };
    window.addEventListener('resize', this.resizeHandler);

    // Start render loop (paused until game is ready)
    this.animate = this.animate.bind(this);
    this.animationId = requestAnimationFrame(this.animate);
  }

  public setOnFrame(callback: (delta: number) => void): void {
    this.onFrameCallback = callback;
  }

  public start(): void {
    // Already running, but mark as active
  }

  private animate(): void {
    if (this.animationId === null) return;

    const rawDelta = Math.min(this.clock.getDelta(), 0.1);
    this.deltaTime = rawDelta;

    if (this.onFrameCallback) {
      this.onFrameCallback(rawDelta);
    }

    this.composer.render();
    this.animationId = requestAnimationFrame(this.animate);
  }

  public resize(): void {
    if (this.resizeHandler) this.resizeHandler();
  }

  public dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    window.removeEventListener('resize', this.resizeHandler!);
    this.renderer.dispose();
    this.composer.dispose();
  }

  /** Update bloom parameters at runtime */
  public setBloom(intensity: number, radius: number, threshold: number): void {
    this.bloomEffect.intensity = intensity;
    // kernelSize maps to radius in v6 API (kernel size controls spread)
    this.bloomEffect.kernelSize = Math.max(1, Math.round(radius * 128));
    this.bloomEffect.luminanceThreshold = threshold;
  }
}
