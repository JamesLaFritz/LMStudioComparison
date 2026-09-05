import * as THREE from 'three';
import { PostFX } from '../shared/render/PostFX.js';
import { CameraRig } from '../shared/render/CameraRig.js';
import { Disposer } from '../shared/core/Disposer.js';
import { PRNG } from '../shared/procgen/PRNG.js';
import { SimplexNoise } from '../shared/procgen/SimplexNoise.js';
import { makeNebulaTexture, releaseSource } from '../shared/procgen/TextureFactory.js';
import { bitmapToGeometry } from '../shared/procgen/GeometryLab.js';
import { MaterialLibrary } from '../shared/procgen/MaterialLibrary.js';

/**
 * Attract-mode scene rendered behind the cabinet select.
 *
 * Deliberately cheap. It exists to prove the pipeline is alive and to give the
 * menu something to sit on, so it runs a small fraction of a real title's
 * budget: one nebula quad, one instanced starfield, and a slow rotating lattice
 * of invader glyphs. No shadows, no dynamic lights, no particles.
 *
 * It shares the engine layer with the games rather than duplicating a
 * simplified version of it, which means the hub is also a continuously running
 * smoke test: if bloom, the composer, procedural geometry or the material
 * library break, the menu shows it before a player ever launches a cabinet.
 */

/** The classic 11x8 "crab" silhouette, used as the hub's mascot glyph. */
const HUB_GLYPH = [
  '..#.....#..',
  '...#...#...',
  '..#######..',
  '.##.###.##.',
  '###########',
  '#.#######.#',
  '#.#.....#.#',
  '...##.##...'
];

export class HubScene {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {object} [opts]
   */
  constructor(renderer, { reducedMotion = false } = {}) {
    this.renderer = renderer;
    this.reducedMotion = reducedMotion;
    this.disposer = new Disposer('HubScene');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05060f, 0.021);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 220);
    this.rig = new CameraRig(this.camera);
    this.rig.setBase(0, 0.4, 21).setTarget(0, 0.2, 0).teleport();

    this.materials = new MaterialLibrary(this.disposer);
    this.rng = new PRNG('hub-attract');
    this.noise = new SimplexNoise(1971);

    this.time = 0;

    this._buildLighting();
    this._buildBackdrop();
    this._buildStars();
    this._buildLattice();

    const size = renderer.getSize(new THREE.Vector2());
    this.postfx = new PostFX(renderer, this.scene, this.camera, {
      bloomPreset: 'deepSpace',
      reducedMotion,
      grain: { grain: 0.035, scanline: 0.04, vignette: 0.62 }
    });
    this.setSize(size.x, size.y);
  }

  _buildLighting() {
    // Two lights, both static. The hub never adds or removes one, so no
    // material in this scene is ever recompiled after the first frame.
    const hemi = new THREE.HemisphereLight(0x1b2a5a, 0x08080f, 0.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xcfe4ff, 0.9);
    key.position.set(5, 8, 7);
    this.scene.add(key);

    this.disposer.trackFn(() => {
      this.scene.remove(hemi);
      this.scene.remove(key);
      hemi.dispose();
      key.dispose();
    });
  }

  _buildBackdrop() {
    const { texture } = makeNebulaTexture({
      size: 1024,
      seed: 88213,
      scale: 2.2,
      core: [0.34, 0.88, 1.0],
      coreStrength: 0.42
    });
    this.disposer.track(texture);

    const material = this.materials.get('hubNebula', () =>
      new THREE.MeshStandardMaterial({
        color: 0x0a0d1c,
        emissive: 0xffffff,
        emissiveMap: texture,
        // Below the bloom threshold on purpose: the backdrop must never
        // compete with the menu text sitting on top of it.
        emissiveIntensity: 0.5,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
        fog: false
      })
    );

    const geometry = new THREE.PlaneGeometry(150, 90);
    this.disposer.track(geometry);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, -48);
    mesh.renderOrder = -10;
    this.scene.add(mesh);
    this.nebula = mesh;

    releaseSource(texture);
    this.disposer.trackFn(() => this.scene.remove(mesh));
  }

  _buildStars() {
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    this.disposer.track(geometry);

    const material = this.materials.get('hubStar', () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xdfefff,
        // Comfortably above the 0.68 threshold of the deepSpace preset, so
        // stars are the brightest thing in the scene and genuinely bloom.
        emissiveIntensity: 2.1,
        roughness: 0.4,
        metalness: 0,
        fog: false
      })
    );

    const count = 260;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    mesh.castShadow = false;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    // Stratified placement: one star per grid cell with a random offset inside
    // it. Purely uniform sampling clumps visibly and reads as noise rather than
    // as a sky.
    const cols = Math.ceil(Math.sqrt(count));
    let placed = 0;

    for (let gy = 0; gy < cols && placed < count; gy++) {
      for (let gx = 0; gx < cols && placed < count; gx++) {
        const x = ((gx + this.rng.next()) / cols - 0.5) * 120;
        const y = ((gy + this.rng.next()) / cols - 0.5) * 70;
        const z = -20 - this.rng.next() * 22;

        position.set(x, y, z);
        const s = this.rng.range(0.02, 0.075);
        scale.set(s, s, s);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(placed, matrix);
        placed++;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    this.stars = mesh;

    this.disposer.trackFn(() => {
      this.scene.remove(mesh);
      mesh.dispose();
    });
  }

  _buildLattice() {
    // The same bitmap-to-geometry pipeline the games use, so the hub validates
    // it at boot.
    const geometry = bitmapToGeometry(HUB_GLYPH, {
      cell: 0.1,
      depth: 0.26,
      bevel: 0.18
    });
    this.disposer.track(geometry);

    const material = this.materials.get('hubGlyph', () =>
      new THREE.MeshStandardMaterial({
        color: 0x1a2440,
        emissive: 0x57e2ff,
        emissiveIntensity: 1.5,
        roughness: 0.34,
        metalness: 0.62
      })
    );

    const cols = 9;
    const rows = 4;
    const count = cols * rows;

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.lattice = mesh;
    this.latticeCols = cols;
    this.latticeRows = rows;

    // Per-instance phase so the idle bob is not synchronised across the grid,
    // which would read as one rigid object rather than as a swarm.
    this.phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.phases[i] = (i % cols) * 0.7 + Math.floor(i / cols) * 1.3;
    }

    this._matrix = new THREE.Matrix4();
    this._pos = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._scale = new THREE.Vector3(1, 1, 1);

    this.disposer.trackFn(() => {
      this.scene.remove(mesh);
      mesh.dispose();
    });
  }

  /**
   * Animate. Uses the raw frame delta — the hub has no hit-stop and no
   * simulation, so there is only one timeline here.
   */
  update(dt) {
    this.time += dt;

    const t = this.time;
    const spacingX = 1.85;
    const spacingY = 1.5;
    const originX = -((this.latticeCols - 1) * spacingX) * 0.5;
    const originY = 2.6;

    // A slow lateral drift with a sine, echoing the march without simulating it.
    const drift = Math.sin(t * 0.28) * 1.5;

    for (let i = 0; i < this.phases.length; i++) {
      const col = i % this.latticeCols;
      const row = Math.floor(i / this.latticeCols);
      const phase = this.phases[i];

      const bob = Math.sin(t * 1.6 + phase) * 0.09;
      const sway = Math.sin(t * 0.9 + phase * 0.4) * 0.05;

      this._pos.set(
        originX + col * spacingX + drift + sway,
        originY - row * spacingY + bob,
        Math.sin(t * 0.5 + phase * 0.2) * 0.4
      );

      this._euler.set(Math.sin(t * 0.7 + phase) * 0.08, Math.sin(t * 0.5 + phase) * 0.22, 0);
      this._quat.setFromEuler(this._euler);
      this._matrix.compose(this._pos, this._quat, this._scale);
      this.lattice.setMatrixAt(i, this._matrix);
    }
    this.lattice.instanceMatrix.needsUpdate = true;

    // Gentle parallax on the backdrop layers.
    this.stars.position.x = Math.sin(t * 0.06) * 1.4;
    this.nebula.position.x = Math.sin(t * 0.04) * 0.7;

    // A very slow camera breathe. Suppressed entirely under reduced motion —
    // a continuously moving background is precisely what that preference is
    // asking us not to do.
    if (!this.reducedMotion) {
      this.rig.setOffset('breathe', Math.sin(t * 0.18) * 0.45, Math.sin(t * 0.13) * 0.22, 0);
    } else {
      this.rig.setOffset('breathe', 0, 0, 0);
    }

    this.rig.update(dt);
    this.postfx.update(dt);
  }

  render() {
    this.postfx.render();
  }

  setSize(width, height) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.postfx.setSize(w, h);
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
    this.postfx.setReducedMotion(enabled);
  }

  setQualityTier(tier) {
    this.postfx.setQualityTier(tier);
  }

  dispose() {
    this.postfx.dispose();
    this.materials.dispose();
    this.disposer.disposeAll();
    this.scene.clear();
  }
}
