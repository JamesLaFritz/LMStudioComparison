import * as THREE from 'three';
import { SeededRng } from '../../shared/core/SeededRng.js';
import { PbrFactory, assertStandardSceneMaterials } from '../../shared/graphics/PbrFactory.js';
import { CanvasTextureFactory } from '../../shared/graphics/CanvasTextureFactory.js';
import { createProceduralAssets } from './ProceduralAssets.js';
import { FormationView } from './FormationView.js';
import { ShieldView } from './ShieldView.js';
import { ProjectileView } from './ProjectileView.js';
import { ArenaView } from './ArenaView.js';
import { GAME_CONFIG } from '../config.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function visitFirstActive(pool, visitor) {
  let found = false;
  pool?.forEachActive?.((entity) => {
    if (found) return;
    found = true;
    visitor(entity);
  });
  return found;
}

function interpolateFixed(previous, current, alpha) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safePrevious = Number.isFinite(previous) ? previous : safeCurrent;
  return (safePrevious + (safeCurrent - safePrevious) * alpha) / GAME_CONFIG.FP_ONE;
}

export class SpaceInvadersScene {
  constructor({ tracker, seed = 0x51ace } = {}) {
    if (!tracker) throw new TypeError('SpaceInvadersScene requires a ResourceTracker.');
    this.tracker = tracker;
    this.seed = seed;
    this.rng = new SeededRng(seed).fork('rendering');
    this.pbr = new PbrFactory({ tracker });
    this.textureFactory = new CanvasTextureFactory({ tracker, rng: this.rng.fork('textures') });
    this.scene = new THREE.Scene();
    this.scene.name = 'space-invaders-scene';
    this.scene.background = new THREE.Color(0x03050d);
    this.camera = new THREE.OrthographicCamera(-14, 14, 14, -14, 0.1, 80);
    this.camera.name = 'orthographic-game-camera';
    this.camera.position.set(0, 0, 30);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld(true);
    this.renderer = null;
    this.environmentTexture = null;
    this.disposed = false;
    this.realTime = 0;

    this.assets = createProceduralAssets({
      tracker,
      pbr: this.pbr,
      textures: this.textureFactory,
      rng: this.rng.fork('assets'),
    });

    this.arenaRoot = new THREE.Group();
    this.arenaRoot.name = 'arena-root';
    this.gameplayRoot = new THREE.Group();
    this.gameplayRoot.name = 'gameplay-root';
    this.scene.add(this.arenaRoot, this.gameplayRoot);

    this.arenaView = new ArenaView({ root: this.arenaRoot, assets: this.assets, rng: this.rng.fork('arena') });
    this.formationView = new FormationView({ root: this.gameplayRoot, assets: this.assets });
    this.shieldView = new ShieldView({ root: this.gameplayRoot, assets: this.assets });
    this.projectileView = new ProjectileView({ root: this.gameplayRoot, assets: this.assets });
    this.#createPlayerView();
    this.#createSaucerView();

    tracker.track(this.arenaRoot);
    tracker.track(this.gameplayRoot);
    assertStandardSceneMaterials(this.scene);
  }

  attachRenderer(renderer) {
    if (!renderer?.isWebGLRenderer) throw new TypeError('attachRenderer requires a WebGLRenderer.');
    this.renderer = renderer;
    if (!this.environmentTexture) this.environmentTexture = this.assets.rebuildEnvironment(renderer);
    this.scene.environment = this.environmentTexture;
    return this.environmentTexture;
  }

  sync(state, alpha = 1, realTime = 0) {
    if (this.disposed || !state) return;
    const interpolation = clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);
    const nextRealTime = Number.isFinite(realTime) ? realTime : this.realTime;
    const realDelta = clamp(nextRealTime - this.realTime, 0, 0.1);
    this.realTime = nextRealTime;
    this.formationView.sync(state, this.realTime);
    this.shieldView.sync(state.shields);
    this.projectileView.sync(state.pools, interpolation, this.realTime);
    this.#syncPlayer(state.player, interpolation);
    this.#syncSaucer(state.pools?.saucer, interpolation);

    const remainingThreat = 1 - clamp((state.aliveAliens ?? GAME_CONFIG.FORMATION.COUNT) / GAME_CONFIG.FORMATION.COUNT, 0, 1);
    const anchorY = (state.formation?.anchorY ?? GAME_CONFIG.FORMATION.START_Y * GAME_CONFIG.FP_ONE) / GAME_CONFIG.FP_ONE;
    const lowestThreat = clamp((GAME_CONFIG.FORMATION.START_Y - anchorY) / 112, 0, 1);
    this.arenaView.syncThreat(remainingThreat * 0.55 + lowestThreat * 0.45, realDelta);
  }

  resize(viewport = {}) {
    const width = Math.max(1, Number(viewport.width) || 1);
    const height = Math.max(1, Number(viewport.height) || 1);
    const aspect = Number(viewport.aspect) > 0 ? viewport.aspect : width / height;
    const halfHeight = Math.max(13.3, 11.7 / aspect);
    const halfWidth = halfHeight * aspect;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.arenaView.setQualityTier(viewport.effectiveTier ?? 'medium');
  }

  rebuildEnvironmentAfterContextRestore(renderer = this.renderer) {
    if (!renderer?.isWebGLRenderer) throw new Error('A renderer is required to rebuild the PMREM environment.');
    this.renderer = renderer;
    this.environmentTexture = this.assets.rebuildEnvironment(renderer, true);
    this.scene.environment = this.environmentTexture;
    return this.environmentTexture;
  }

  releaseGpuResourcesForContextLoss() {
    this.arenaView.releaseGpuResourcesForContextLoss();
  }

  getTrailSamples(visitor, scratch = {}) {
    return this.projectileView.getTrailSamples(visitor, scratch);
  }

  applyParallax(cameraOffset) {
    this.arenaView.applyParallax(cameraOffset);
  }

  markGpuDataDirty() {
    this.formationView.markGpuDataDirty();
    this.shieldView.markGpuDataDirty();
    this.projectileView.markGpuDataDirty();
    this.arenaView.markGpuDataDirty();
    for (const texture of Object.values(this.assets.textures)) texture.needsUpdate = true;
  }

  getStats(target = {}) {
    let alienInstances = 0;
    for (const pair of this.formationView.meshes) for (const mesh of pair) alienInstances += mesh.count;
    let projectileInstances = 0;
    for (const mesh of this.projectileView.meshes) projectileInstances += mesh.count;
    target.alienInstances = alienInstances;
    target.shieldInstances = this.shieldView.mesh.count;
    target.projectileInstances = projectileInstances;
    target.playerVisible = this.playerRoot.visible;
    target.saucerVisible = this.saucerRoot.visible;
    target.materialAudit = assertStandardSceneMaterials(this.scene);
    return target;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.formationView.detach();
    this.shieldView.detach();
    this.projectileView.detach();
    this.arenaView.detach();
    this.playerRoot.removeFromParent();
    this.saucerRoot.removeFromParent();
    this.arenaRoot.removeFromParent();
    this.gameplayRoot.removeFromParent();
    this.scene.environment = null;
    this.environmentTexture = null;
    this.renderer = null;
    this.pbr.disposeReferences();
    this.textureFactory.disposeReferences();
  }

  #createPlayerView() {
    this.playerRoot = new THREE.Group();
    this.playerRoot.name = 'defender-craft';
    const hull = new THREE.Mesh(this.assets.geometries.playerHull, this.assets.materials.playerHull);
    hull.name = 'defender-hull';
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.playerRoot.add(hull);
    for (const x of [-0.24, 0.24]) {
      const rail = new THREE.Mesh(this.assets.geometries.playerRail, this.assets.materials.playerAccent);
      rail.name = 'defender-recoil-rail';
      rail.position.set(x, 0.13, 0.05);
      rail.castShadow = true;
      this.playerRoot.add(rail);
    }
    this.playerReactor = new THREE.Mesh(this.assets.geometries.playerReactor, this.assets.materials.playerAccent);
    this.playerReactor.name = 'defender-reactor';
    this.playerReactor.position.set(0, -0.18, 0.1);
    this.playerRoot.add(this.playerReactor);
    this.gameplayRoot.add(this.playerRoot);
  }

  #createSaucerView() {
    this.saucerRoot = new THREE.Group();
    this.saucerRoot.name = 'bonus-saucer';
    const hull = new THREE.Mesh(this.assets.geometries.saucerHull, this.assets.materials.saucerHull);
    hull.name = 'saucer-hull';
    hull.castShadow = true;
    this.saucerRoot.add(hull);
    this.saucerRing = new THREE.Mesh(this.assets.geometries.saucerRing, this.assets.materials.saucerAccent);
    this.saucerRing.name = 'saucer-emissive-ring';
    this.saucerRing.position.z = 0.04;
    this.saucerRoot.add(this.saucerRing);
    this.saucerRoot.visible = false;
    this.gameplayRoot.add(this.saucerRoot);
  }

  #syncPlayer(player, alpha) {
    if (!player?.active || player.visible === false) {
      this.playerRoot.visible = false;
      return;
    }
    this.playerRoot.visible = true;
    const logicalX = interpolateFixed(player.prevX, player.x, alpha);
    const logicalY = interpolateFixed(player.prevY, player.y, alpha);
    this.playerRoot.position.set(
      (logicalX - this.assets.logicalCenterX) * this.assets.logicalScale,
      (logicalY - this.assets.logicalCenterY) * this.assets.logicalScale,
      0.08,
    );
    const pulse = 1 + 0.08 * Math.sin(this.realTime * 8);
    this.playerReactor.scale.setScalar(player.vulnerable === false ? 0.72 : pulse);
  }

  #syncSaucer(pool, alpha) {
    const visible = visitFirstActive(pool, (saucer) => {
      const logicalX = interpolateFixed(saucer.prevX, saucer.x, alpha);
      const logicalY = interpolateFixed(saucer.prevY, saucer.y, alpha);
      this.saucerRoot.position.set(
        (logicalX - this.assets.logicalCenterX) * this.assets.logicalScale,
        (logicalY - this.assets.logicalCenterY) * this.assets.logicalScale,
        0.12,
      );
      this.saucerRing.rotation.z = this.realTime * 2.8;
    });
    this.saucerRoot.visible = visible;
  }
}
