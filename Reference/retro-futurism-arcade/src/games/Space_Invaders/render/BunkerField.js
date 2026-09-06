import * as THREE from 'three';
import { BUNKER, RENDER } from '../config.js';
import { gridToWorld } from '../content/BunkerMask.js';
import { makeRoughnessNoiseTexture, releaseSource } from '@shared/procgen/TextureFactory.js';
import { applyInstanceTint } from '@shared/procgen/MaterialLibrary.js';

/**
 * The four bunkers, as **1,408 individually-drawn cells in one draw call**.
 *
 * ### Why this is the second-largest density system in the build
 *
 * The reference frames carry one to two orders of magnitude more distinct
 * bright features than a 500-particle budget can produce. That gap is closed
 * with geometry, not with particles, and after the 530-star field this is the
 * biggest single contributor: 4 bunkers x 22 x 16 = 1,408 cells, each a
 * separately-lit voxel with its own faces, its own highlight and its own
 * shadow side. Together with the starfield and the formation the frame carries
 * roughly two thousand individually-lit elements before a single spark is
 * spawned, which is the right order of magnitude.
 *
 * It is also what makes the erosion read. A bunker drawn as one mesh with a
 * texture would have to rebuild that texture on every hit; drawn as cells, a
 * carve is a change of `count` and a rewrite of the matrix buffer, and the
 * hole has genuine three-dimensional edges that catch the key light.
 *
 * ### The dirty flag is load-bearing
 *
 * `SimState` marks a bunker dirty when its grid changes, and this module
 * rebuilds only when at least one is. A single bomb impact carves several
 * cells in one tick; without the flag that is one full 1,408-cell rebuild per
 * carve instead of one per tick. The rebuild is a straight scan with no
 * allocation, so the cost when it does run is a few microseconds.
 *
 * ### Material
 *
 * The one non-metal in the game: metalness 0.10, roughness 0.62, emissive
 * 0.30. Roughness above 0.5 is deliberate — chalky, eroding, structural — and
 * it is one of only two surfaces in the build above that line, which is where
 * r181's improved energy conservation makes materials measurably brighter.
 * The emissive was cut from the frozen 0.42 to pay for that lift rather than
 * flattening the roughness, because roughness is carrying the material's
 * identity here and the emissive is not.
 */

/**
 * Cell depth as a multiple of cell width.
 *
 * Deeper than wide on purpose. A cube-shaped cell viewed head-on shows one
 * face and reads as a flat tile; a deeper one shows a sliver of its sides at
 * the edges of the bunker and at every carved hole, which is where the light
 * and dark faces that make it read as *matter* actually live.
 */
const CELL_DEPTH_RATIO = 1.5;

/**
 * Deterministic per-cell hash in 0..1.
 *
 * A PRNG would work too, but this is a pure function of the cell index, which
 * means the same bunker looks the same in every capture and across a context
 * loss and rebuild — a randomised one would repaint the whole field on every
 * mount and turn any pixel comparison into noise.
 */
function hash01(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export class BunkerField {
  /**
   * @param {object} deps
   * @param {THREE.Scene} deps.scene
   * @param {import('@shared/procgen/MaterialLibrary.js').MaterialLibrary} deps.materials
   * @param {import('@shared/core/Disposer.js').Disposer} deps.disposer
   */
  constructor({ scene, materials, disposer }) {
    this.scene = scene;
    this.materials = materials;
    this.disposer = disposer;

    /** Total cell capacity across all four bunkers. */
    this.capacity = BUNKER.COUNT * BUNKER.COLS * BUNKER.ROWS;
    /** Cells drawn on the last rebuild. */
    this.drawn = 0;

    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._scale = new THREE.Vector3(1, 1, 1);
    this._world = { x: 0, y: 0 };

    this._build();
  }

  _build() {
    // A plain box, not a rounded one. At 1,408 instances the rounded variant
    // costs 48 triangles each instead of 12 — 67,000 against 17,000 — and a
    // cell is 0.115 world units, which is 0.55% of frame height, six pixels
    // at 1080p. Nobody resolves a chamfer on a six-pixel cube; everybody
    // notices the triangle budget it spends.
    const geometry = new THREE.BoxGeometry(
      BUNKER.CELL,
      BUNKER.CELL,
      BUNKER.CELL * CELL_DEPTH_RATIO
    );
    this.disposer.track(geometry);

    const { texture } = makeRoughnessNoiseTexture({
      size: 128,
      seed: 6112,
      base: RENDER.SURFACE.bunker.roughness,
      variance: 0.2,
      scale: 5,
      streaks: 24
    });
    this.disposer.track(texture);

    // Per-cell brightness jitter.
    //
    // Every cell is an identical cube on a regular grid facing an identical
    // direction, so under one key light every front face returns exactly the
    // same shade and a bunker renders as one flat green slab — which is what
    // the first capture showed. Nothing about the lighting fixes that; the
    // geometry genuinely is uniform. A deterministic +/-22% tint per cell
    // breaks it into visible voxels, which is both what makes the erosion
    // legible and what makes the material read as chalky rather than as
    // painted metal. Deterministic rather than random so that two captures of
    // the same state are pixel-identical.
    const tints = new Float32Array(this.capacity * 3);
    for (let i = 0; i < this.capacity; i++) {
      const jitter = 0.78 + 0.44 * hash01(i);
      tints[i * 3 + 0] = jitter;
      tints[i * 3 + 1] = jitter;
      tints[i * 3 + 2] = jitter;
    }
    geometry.setAttribute('instanceTint', new THREE.InstancedBufferAttribute(tints, 3));

    const surface = RENDER.SURFACE.bunker;
    const material = this.materials.get('siBunker', () => {
      const mat = new THREE.MeshStandardMaterial({
        color: BUNKER.COLOR,
        emissive: BUNKER.EMISSIVE,
        emissiveIntensity: BUNKER.EMISSIVE_INTENSITY,
        roughnessMap: texture,
        roughness: surface.roughness,
        metalness: surface.metalness
      });
      return applyInstanceTint(mat, 'si-bunker-cell');
    });

    const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
    this.mesh = mesh;

    releaseSource(texture);
    this.disposer.trackFn(() => {
      this.scene.remove(mesh);
      mesh.dispose();
    });
  }

  /**
   * Rebuild the instance buffer if any bunker's occupancy grid changed.
   *
   * Reads `bunker.dirty` but does **not** clear it — the simulation owns that
   * flag and the render layer is a reader. Clearing it here would mean that
   * whichever consumer ran first silently starved the others, which is exactly
   * the class of bug that only shows up once a second consumer is added.
   *
   * @param {object} state simulation state, read only
   * @param {boolean} [force] rebuild regardless, e.g. after a context restore
   * @returns {boolean} whether a rebuild ran
   */
  update(state, force = false) {
    let dirty = force;
    for (let b = 0; b < state.bunkers.length && !dirty; b++) {
      if (state.bunkers[b].dirty) dirty = true;
    }
    if (!dirty) return false;

    let drawn = 0;
    const depth = 0;

    for (let b = 0; b < state.bunkers.length; b++) {
      const bunker = state.bunkers[b];
      const grid = bunker.grid;

      for (let cy = 0; cy < BUNKER.ROWS; cy++) {
        for (let cx = 0; cx < BUNKER.COLS; cx++) {
          if (!grid[cy * BUNKER.COLS + cx]) continue;

          // The one correct way to ask where a cell is. Duplicating the
          // arithmetic here would let the visual cells drift away from the
          // cells collision carves, and the symptom — shots passing through
          // visible material — would look like a collision bug.
          gridToWorld(cx, cy, bunker.x, this._world);
          this._position.set(this._world.x, this._world.y, depth);
          this._matrix.compose(this._position, this._quaternion, this._scale);
          this.mesh.setMatrixAt(drawn, this._matrix);
          drawn++;
        }
      }
    }

    this.mesh.count = drawn;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.drawn = drawn;
    return true;
  }
}
