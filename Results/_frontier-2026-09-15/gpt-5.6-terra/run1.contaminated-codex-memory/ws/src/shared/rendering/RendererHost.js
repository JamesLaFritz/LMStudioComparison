import * as THREE from 'three';
import { ResourceRegistry } from '../core/ResourceRegistry.js';
import { createPostFX } from './PostFX.js';

const QUALITY = {
  high: { pixelRatio: 2, bloom: true },
  medium: { pixelRatio: 1.5, bloom: true },
  low: { pixelRatio: 1, bloom: false },
};

/**
 * Browser-facing Three host. Game renderers add their objects to scene and
 * can place their authored camera pose on cameraRig; shake is isolated in the
 * nested shakeRig exposed through cameraRig.userData.shakeRig.
 */
export class RendererHost {
  constructor({
    host = globalThis.document?.body ?? null,
    canvas = null,
    scene = null,
    camera = null,
    registry = null,
    clearColor = 0x02060d,
    quality = 'high',
    bloom = {},
    onContextLost = null,
    onContextRestored = null,
  } = {}) {
    if (!globalThis.document) throw new Error('RendererHost requires a browser document.');
    this.registry = registry ?? new ResourceRegistry('renderer-host');
    this.host = host;
    this.ownsCanvas = !canvas;
    this.canvas = canvas ?? globalThis.document.createElement('canvas');
    this.canvas.classList.add('arcade-webgl-canvas');
    this.canvas.setAttribute('aria-label', 'Space Invaders game view');
    this.canvas.tabIndex = -1;
    if (this.ownsCanvas && host && !this.canvas.parentNode) host.appendChild(this.canvas);

    this.scene = scene ?? new THREE.Scene();
    this.scene.background = new THREE.Color(clearColor);
    this.camera = camera ?? new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    this.cameraRig = new THREE.Group();
    this.cameraRig.name = 'camera-rig';
    this.shakeRig = new THREE.Group();
    this.shakeRig.name = 'camera-shake-rig';
    this.cameraRig.add(this.shakeRig);
    this.camera.parent?.remove(this.camera);
    this.shakeRig.add(this.camera);
    this.cameraRig.userData.shakeRig = this.shakeRig;
    this.camera.position.set(0, 0, 26);
    this.scene.add(this.cameraRig);
    this.registry.trackObject(this.cameraRig);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(clearColor, 1);

    this.quality = QUALITY[quality] ? quality : 'high';
    this._bloomOptions = bloom;
    this._onContextLostCallback = onContextLost;
    this._onContextRestoredCallback = onContextRestored;
    this.isContextLost = false;
    this.isDisposed = false;
    this._lastRenderTime = 0;
    this._onResize = this._onResize.bind(this);
    this._onContextLost = this._onContextLost.bind(this);
    this._onContextRestored = this._onContextRestored.bind(this);
    this.canvas.addEventListener('webglcontextlost', this._onContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this._onContextRestored, false);
    globalThis.window?.addEventListener?.('resize', this._onResize, { passive: true });

    const viewport = measure(this.host);
    this.postFX = createPostFX({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      width: viewport.width,
      height: viewport.height,
      pixelRatio: this._pixelRatio(),
      bloom,
    });
    this.resize(viewport.width, viewport.height);
  }

  render(deltaTime = 0) {
    if (this.isDisposed || this.isContextLost) return false;
    const safeDelta = Number.isFinite(deltaTime) ? deltaTime : 0;
    this.postFX.render(safeDelta);
    this._lastRenderTime = safeDelta;
    return true;
  }

  resize(width, height) {
    if (this.isDisposed) return;
    const nextWidth = Math.max(1, Math.floor(width ?? measure(this.host).width));
    const nextHeight = Math.max(1, Math.floor(height ?? measure(this.host).height));
    const pixelRatio = this._pixelRatio();
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(nextWidth, nextHeight, false);
    this.camera.aspect = nextWidth / nextHeight;
    this.camera.updateProjectionMatrix();
    this.postFX?.resize(nextWidth, nextHeight, pixelRatio);
  }

  setQuality(quality) {
    if (!QUALITY[quality] || this.quality === quality) return;
    this.quality = quality;
    this.postFX.bloomPass.enabled = QUALITY[quality].bloom;
    this.resize();
  }

  setClearColor(color, alpha = 1) {
    this.renderer.setClearColor(color, alpha);
    this.scene.background = new THREE.Color(color);
  }

  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;
    globalThis.window?.removeEventListener?.('resize', this._onResize);
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored, false);
    this.postFX?.dispose();
    this.registry.dispose();
    this.renderer.renderLists?.dispose?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    if (this.ownsCanvas) this.canvas.parentNode?.removeChild(this.canvas);
  }

  _pixelRatio() {
    return Math.min(globalThis.devicePixelRatio || 1, QUALITY[this.quality].pixelRatio);
  }

  _onResize() {
    const viewport = measure(this.host);
    this.resize(viewport.width, viewport.height);
  }

  _onContextLost(event) {
    event.preventDefault?.();
    this.isContextLost = true;
    this._onContextLostCallback?.();
  }

  _onContextRestored() {
    this.isContextLost = false;
    this.resize();
    this._onContextRestoredCallback?.();
  }
}

export function createRendererHost(options = {}) {
  return new RendererHost(options);
}

function measure(host) {
  const width = host?.clientWidth || globalThis.window?.innerWidth || 1280;
  const height = host?.clientHeight || globalThis.window?.innerHeight || 720;
  return { width: Math.max(1, width), height: Math.max(1, height) };
}
