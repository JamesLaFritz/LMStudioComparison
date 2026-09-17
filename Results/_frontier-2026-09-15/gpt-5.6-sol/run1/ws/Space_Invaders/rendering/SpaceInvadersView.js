import * as THREE from 'three';
import { ResourceTracker } from '../../shared/rendering/ResourceTracker.js';
import { RenderPipeline } from '../../shared/rendering/RenderPipeline.js';
import { PALETTE } from '../config.js';
import { createMaterialPalette } from './MaterialFactory.js';
import { FleetRenderer } from './FleetRenderer.js';
import { DefenseRenderer } from './DefenseRenderer.js';
import { ProjectileRenderer } from './ProjectileRenderer.js';
import { EnvironmentRenderer } from './EnvironmentRenderer.js';

export class SpaceInvadersView {
  constructor(canvas, { onContextLost = () => {}, onContextRestored = () => {} } = {}) {
    this.canvas = canvas;
    this.tracker = new ResourceTracker();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.background);
    this.scene.fog = new THREE.FogExp2(PALETTE.background, 0.016);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 90);
    this.basePosition = new THREE.Vector3();
    this.baseQuaternion = new THREE.Quaternion();
    this.lookTarget = new THREE.Vector3(0, 0.35, 0);
    this.elapsed = 0;
    this.waveDolly = 0;

    this.pipeline = new RenderPipeline({
      canvas,
      scene: this.scene,
      camera: this.camera,
      bloom: { strength: 0.68, radius: 0.22, threshold: 0.9, exposure: 1.0 },
      onResize: (width, height) => this._fitCamera(width, height),
      onContextLost,
      onContextRestored,
    });
    this.materials = createMaterialPalette(this.tracker);
    this._createLights();
    this.environment = new EnvironmentRenderer(
      this.scene,
      this.tracker,
      this.materials,
      this.pipeline.renderer,
    );
    this.fleet = new FleetRenderer(this.scene, this.tracker, this.materials);
    this.defense = new DefenseRenderer(this.scene, this.tracker, this.materials.bunker);
    this.projectiles = new ProjectileRenderer(this.scene, this.tracker, this.materials);
    this._fitCamera(this.pipeline.width, this.pipeline.height);
  }

  _createLights() {
    const hemisphere = new THREE.HemisphereLight(0x6eb9d8, 0x080713, 1.25);
    const key = new THREE.DirectionalLight(0xd8f7ff, 2.2);
    key.position.set(-3, 8, 12);
    const cyan = new THREE.PointLight(PALETTE.cyan, 6.5, 12, 2);
    cyan.position.set(-8, -7.5, 4);
    const magenta = new THREE.PointLight(PALETTE.magenta, 5, 11, 2);
    magenta.position.set(8, 6, 3);
    this.scene.add(hemisphere, key, cyan, magenta);
    this.tracker.track(hemisphere);
    this.tracker.track(key);
    this.tracker.track(cyan);
    this.tracker.track(magenta);
  }

  _fitCamera(width, height) {
    if (width <= 0 || height <= 0) return;
    const aspect = width / height;
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    const distanceForHeight = 11 / Math.tan(halfFov);
    const distanceForWidth = 12.75 / (Math.tan(halfFov) * aspect);
    const distance = Math.max(27.5, distanceForHeight, distanceForWidth);
    this.basePosition.set(0, 0.7, distance);
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.lookTarget);
    this.baseQuaternion.copy(this.camera.quaternion);
  }

  announceWaveStart() {
    this.waveDolly = 1;
    this.environment.triggerPulse(1);
  }

  pulseBloom(amount = 0.18) {
    this.pipeline.pulseBloom(amount);
  }

  render(simulation, alpha, frameDt, shake, profile) {
    this.elapsed += frameDt;
    this.waveDolly *= Math.exp(-2.8 * frameDt);
    this.fleet.update(simulation, alpha, this.elapsed);
    this.defense.update(simulation, this.elapsed);
    this.projectiles.update(simulation, alpha, this.elapsed);
    this.environment.update(frameDt, this.elapsed);

    this.camera.position.copy(this.basePosition);
    this.camera.position.z += profile.reducedMotion ? 0 : this.waveDolly * 1.4;
    this.camera.quaternion.copy(this.baseQuaternion);
    if (shake) {
      this.camera.position.x += shake.x;
      this.camera.position.y += shake.y;
      this.camera.position.z += shake.z;
      this.camera.rotateX(shake.pitch);
      this.camera.rotateY(shake.yaw);
      this.camera.rotateZ(shake.roll);
    }
    this.pipeline.update(frameDt, profile.reducedFlashes);
    this.pipeline.render(frameDt);
  }

  setPixelRatioCap(cap) {
    this.pipeline.setPixelRatioCap(cap);
  }

  memorySnapshot() {
    return this.pipeline.memorySnapshot();
  }

  dispose() {
    this.projectiles.dispose();
    this.defense.dispose();
    this.fleet.dispose();
    this.environment.dispose();
    this.tracker.dispose();
    this.pipeline.dispose();
  }
}
