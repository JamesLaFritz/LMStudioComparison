import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Clock,
  EventDispatcher,
  ACESFilmicToneMapping,
} from 'three';
import { setupPostProcessing } from './PostProcessing';

export interface EngineCallbacks {
  update: (dt: number) => void;
  render?: () => void;
}

export class Engine extends EventDispatcher {
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private composer: any;
  private clock: Clock;
  private callbacks: EngineCallbacks;
  private animationId: number | null = null;
  private isPaused: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    scene: Scene,
    camera: PerspectiveCamera,
    callbacks: EngineCallbacks
  ) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.callbacks = callbacks;
    this.clock = new Clock();

    // Renderer setup
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Post-processing
    this.composer = setupPostProcessing(this.renderer, scene, camera);

    // Handle resize
    const onResize = (): void => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      if (this.composer) {
        this.composer.setSize(w, h);
      }
    };
    window.addEventListener('resize', onResize);

    // Visibility change — pause when hidden
    const onVisibilityChange = (): void => {
      this.isPaused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    this.startLoop();
  }

  private startLoop(): void {
    const loop = (): void => {
      this.animationId = requestAnimationFrame(loop);
      if (this.isPaused) return;

      const dt = Math.min(this.clock.getDelta(), 0.1); // cap at 100ms to prevent spiral
      this.callbacks.update(dt);
      if (this.callbacks.render) {
        this.callbacks.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };
    this.animationId = requestAnimationFrame(loop);
  }

  /** Update the composer's render target size */
  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.composer) {
      this.composer.setSize(w, h);
    }
  }

  /** Graceful shutdown — dispose all resources */
  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.renderer.dispose();
    this.scene.traverse((obj) => {
      if ((obj as any).geometry) (obj as any).geometry.dispose();
      if ((obj as any).material) {
        const mats = Array.isArray((obj as any).material)
          ? (obj as any).material
          : [(obj as any).material];
        for (const mat of mats) {
          if (mat.dispose) mat.dispose();
        }
      }
    });
  }

  /** Get the renderer instance */
  getRenderer(): WebGLRenderer {
    return this.renderer;
  }

  /** Get the composer instance */
  getComposer(): any {
    return this.composer;
  }

  /** Get the scene */
  getScene(): Scene {
    return this.scene;
  }

  /** Get the camera */
  getCamera(): PerspectiveCamera {
    return this.camera;
  }
}
