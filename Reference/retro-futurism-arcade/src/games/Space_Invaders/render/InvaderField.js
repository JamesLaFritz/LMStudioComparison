import * as THREE from 'three';
import { FORMATION, SPECIES, ROW_SPECIES, RENDER } from '../config.js';
import { SPECIES_BITMAPS } from '../content/InvaderBitmaps.js';
import { columnOf, rowOf, invaderX, invaderY } from '../simulation/SimState.js';
import {
  bitmapToGeometry,
  bitmapOutlineGeometry,
  centerTogether,
  createRoundedBox,
  mergeAndDispose,
  triangleCount
} from '@shared/procgen/GeometryLab.js';
import { applyInstanceTint } from '@shared/procgen/MaterialLibrary.js';
import { saturate, easeOutBack } from '@shared/util/MathUtils.js';

/**
 * The 55-invader lattice.
 *
 * ### The one thing this module exists to get right
 *
 * Fifty-five objects in a tight 11 x 5 grid is the single most dangerous
 * subject matter in the whole build, because the obvious authoring — make the
 * enemies glow, they are neon aliens — produces a solid luminous rectangle.
 * The shared bloom preset's own comment warns about it, and no bloom parameter
 * can undo it: if the frame genuinely contains 55 light sources, lowering the
 * strength dims the whole game and merges them anyway.
 *
 * The reference does the opposite. At magnification every enemy hull there is
 * **lit matter**: a saturated mid-dark albedo with visible light and dark
 * faces, a thin near-white line tracing the silhouette, and exactly one small
 * hot accent per craft. The light in those frames belongs to the projectiles
 * and the impacts; two dozen enemy craft contribute none of it.
 *
 * So each invader is drawn in three tiers, and only the third one glows:
 *
 * | Part | emissive | Blooms |
 * |---|---|---|
 * | Hull body | species colour at **0.35** | no |
 * | Silhouette outline | species colour at **1.05** | no — deliberately just under the 1.368 glow floor |
 * | Eye dot, <= 4% of hull area | species colour at **2.1** | **yes** |
 *
 * A full formation therefore puts **55 small hot points** into the bloom
 * buffer instead of 55 slabs, which is both what the reference does and the
 * cheapest possible fix for the named failure.
 *
 * ### Draw-call and geometry layout
 *
 * Three `InstancedMesh`es, one per species, sized to that species' share of
 * the lattice (11 squid, 22 crab, 22 octopus). Each carries a merged geometry
 * with **two groups** — hull, then outline — and a two-material array, so hull
 * and rim ride the same instance buffer and the same matrix update. The two
 * march poses are two prebuilt geometries and the step swaps the reference;
 * both stay allocated and tracked, because rebuilding a geometry on a march
 * step would allocate at 18 Hz in the late game.
 *
 * A fourth `InstancedMesh` carries the 55 eye dots with a per-instance tint,
 * so all three species' accents are one draw call in three colours.
 *
 * Total: **4 draw calls and about 77,000 triangles** for the entire formation,
 * against a budget of 60 and 150,000.
 *
 * ### What this module may and may not touch
 *
 * It reads `SimState` and writes matrices. It never mutates simulation state,
 * and it never derives a position by any means other than `invaderX` /
 * `invaderY`, so the sprites can never drift away from the hitboxes. The idle
 * bob applied here is deliberately *excluded* from those helpers for exactly
 * that reason — it is a visual flourish, and folding it into collision would
 * make the hitboxes breathe.
 */

/** Extrusion depth of an invader hull, world units. */
const HULL_DEPTH = 0.3;

/**
 * Outline width in world units.
 *
 * The reference's rim is 1-2 px at 1080p. At this project's camera 1% of frame
 * height is 0.208 world units, so 1-2 px is 0.10-0.20% of frame height is
 * 0.021-0.042 world units. 0.03 sits in the middle of that and is the same
 * value on every species, because the rim is a property of the *lens*, not of
 * the object: a thicker line on the wider octopus would read as a different
 * material rather than as a bigger ship.
 */
const RIM_THICKNESS = 0.03;

/**
 * Corner radius as a fraction of one sprite cell.
 *
 * Rounding the greedy-meshed boxes does two things. It grooves the seams
 * between adjacent rectangles, so a hull reads as voxel construction under a
 * key light rather than as one flat slab — this is the "visible faceted
 * shading, light faces and dark faces" the reference shows at magnification.
 * And it gives every edge a curved band that catches a specular highlight,
 * which a hard 90-degree edge catches on exactly zero pixels.
 */
const HULL_ROUNDING = 0.22;

/** Eye dot size, world units. See `_buildEyes` for the area budget. */
const EYE_SIZE = 0.11;
/** Eye dot placement above the hull's centre, as a fraction of hull height. */
const EYE_HEIGHT_FRACTION = 0.07;

export class InvaderField {
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

    this.time = 0;
    /** Which march pose is showing. Mirrors `formation.animFrame`. */
    this.pose = 0;

    /**
     * Lattice indices belonging to each species, precomputed once.
     * Row species assignment never changes, so scanning for it every frame
     * would be 55 modulo operations per frame for a constant answer.
     * @type {number[][]}
     */
    this.speciesIndices = SPECIES.map(() => []);
    for (let index = 0; index < FORMATION.COUNT; index++) {
      this.speciesIndices[ROW_SPECIES[rowOf(index)]].push(index);
    }

    /** @type {Array<{mesh:THREE.InstancedMesh, poses:THREE.BufferGeometry[]}>} */
    this.species = [];

    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._scale = new THREE.Vector3(1, 1, 1);

    /** Triangles drawn by a full, living formation. Reported to the debug panel. */
    this.triangles = 0;

    SPECIES.forEach((species, index) => this._buildSpecies(species, index));
    this._buildEyes();
  }

  /* ================================================================== *
   * Construction
   * ================================================================== */

  /**
   * One species: two pose geometries and one `InstancedMesh` with a
   * two-material array.
   *
   * The sprite cell size is derived, not chosen: every invader bitmap is eight
   * pixels tall and `config.js` states each species' target world height, so
   * `cell = height / 8` makes the built geometry land on the declared
   * `halfWidth` / `halfHeight` exactly, with no rescaling step anywhere. That
   * is checked rather than assumed — the constructor asserts the resulting
   * bounding box against the config.
   */
  _buildSpecies(species, speciesIndex) {
    const bitmaps = SPECIES_BITMAPS[speciesIndex].poses;
    const cell = species.height / bitmaps[0].length;

    const poses = bitmaps.map((rows) => {
      const hull = bitmapToGeometry(rows, {
        cell,
        depth: HULL_DEPTH,
        rounded: HULL_ROUNDING,
        roundSegments: 2,
        // Centred as a pair with the outline below, not individually: the
        // outline's bounding box is half a rim thicker on every side, and
        // centring them apart would offset them by exactly the width of the
        // line being drawn.
        center: false
      });
      const outline = bitmapOutlineGeometry(rows, {
        cell,
        // A hair deeper than the hull so the rim always wins the depth test on
        // the front face rather than z-fighting with it.
        depth: HULL_DEPTH * 1.06,
        thickness: RIM_THICKNESS,
        center: false
      });
      centerTogether([hull, outline]);

      // Groups, in this order: 0 = hull, 1 = outline. The material array below
      // must match.
      const merged = mergeAndDispose([hull, outline], true);
      this.disposer.track(merged);
      return merged;
    });

    const surface = RENDER.SURFACE.invader;

    const hullMaterial = this.materials.get(`siInvaderHull${speciesIndex}`, () =>
      new THREE.MeshStandardMaterial({
        color: species.color,
        // The hull's emissive is its **own dark albedo**, not the species'
        // bright accent hue. That distinction is the whole fix and it is easy
        // to get backwards: authored with the accent hue at 0.35 the hulls
        // came out as solid saturated violet and magenta slabs — measured at
        // 72% mean saturation of lit pixels against a reference envelope of
        // 38-65% — because 0.35 of a fully saturated bright colour is still a
        // strong colour against a near-black ground. Authored with the hull
        // colour, 0.35 is a barely-perceptible lift off pure black, the key
        // light does all the visible work, and the hull reads as lit matter.
        emissive: species.color,
        // 0.35 — a quarter of the glow floor. The hull is albedo, not light.
        emissiveIntensity: species.emissiveIntensity,
        // Below 0.5 on purpose: r181's energy-conservation change makes rough
        // materials brighter, and this surface must stay in the frame's
        // shadow range.
        roughness: surface.roughness,
        metalness: surface.metalness
      })
    );

    // The rim's colour is the species hue pulled halfway to white.
    //
    // The spec says two things about this line that look contradictory and are
    // not: it is measured off the reference as "a 1-2 px **near-white** rim",
    // and it is specified as "species emissive colour", because row identity by
    // hue is the classic's own readability device. Both are satisfied by a
    // half-lerp: the line still reads unmistakably cyan, violet or magenta at a
    // glance, and it is bright enough to be a highlight rather than a coloured
    // stripe.
    //
    // Measured, that lerp is what fixes two envelope failures at once. Fully
    // saturated rims put the mean saturation of lit pixels at 69% against a
    // reference range of 38-65%, and — because a saturated colour has low
    // luminance by construction — held the frame's 99th-percentile luminance at
    // 0.24 against a floor of 0.68. Whitening the rim raises its luminance by
    // roughly 3x without touching its emissive intensity, which is what puts
    // real highlights in a frame whose brightest object is a thin outline.
    // A third of the way to white, not half. At half the octopus rows read as
    // pale pink outlines and the three species stopped being tellable apart at
    // a glance, which throws away the classic's own row-identity device to buy
    // a metric. A third keeps the hue unmistakable and still measures inside
    // the reference's saturation envelope.
    const rimColour = new THREE.Color(species.emissive).lerp(new THREE.Color(0xffffff), 0.33);

    const rimMaterial = this.materials.get(`siInvaderRim${speciesIndex}`, () =>
      new THREE.MeshStandardMaterial({
        // Nearly black albedo: the rim's brightness must come from emission,
        // so that it is identical whether the invader is under the key light
        // or in the fill's shadow. A lit rim would flicker as the formation
        // marched through the lighting.
        color: 0x05090c,
        emissive: rimColour,
        // 1.05 — deliberately just under `minimumGlowIntensity(0.72)` = 1.368,
        // so the line reads bright and crisp and contributes nothing at all to
        // the bloom buffer.
        emissiveIntensity: species.rimIntensity,
        roughness: 0.3,
        metalness: 0.2
      })
    );

    const capacity = this.speciesIndices[speciesIndex].length;
    const mesh = new THREE.InstancedMesh(poses[0], [hullMaterial, rimMaterial], capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The formation spans most of the arena and is always at least partly on
    // screen; per-instance culling is not available on an InstancedMesh anyway,
    // and the whole-mesh bounding sphere is recomputed from geometry that does
    // not move, so leaving culling on would pop the entire formation out.
    mesh.frustumCulled = false;
    mesh.count = 0;

    this.scene.add(mesh);
    this.species.push({ mesh, poses, capacity });
    this.triangles += triangleCount(poses[0]) * capacity;

    this.disposer.trackFn(() => {
      this.scene.remove(mesh);
      mesh.dispose();
    });

    // Assert the derived cell size actually reproduced the declared hitbox.
    // A silent mismatch here would put every sprite a few percent off its own
    // collision box, which is the class of bug that reads as "the hit
    // detection feels wrong" and is never traced back to the mesh.
    const box = poses[0].boundingBox;
    const halfWidth = (box.max.x - box.min.x) * 0.5;
    const halfHeight = (box.max.y - box.min.y) * 0.5;
    // The outline overhangs the hull by half a rim on every side.
    const slack = RIM_THICKNESS * 0.5 + 1e-3;
    if (
      Math.abs(halfWidth - species.halfWidth) > slack ||
      Math.abs(halfHeight - species.halfHeight) > slack
    ) {
      console.warn(
        `InvaderField: ${species.key} mesh is ${halfWidth.toFixed(3)} x ` +
          `${halfHeight.toFixed(3)} but config declares ` +
          `${species.halfWidth} x ${species.halfHeight}.`
      );
    }
  }

  /**
   * The 55 eye dots — the only part of an invader that is allowed to glow.
   *
   * ### The area budget, stated
   *
   * The reference allows one hot accent per craft at roughly 2% of the hull's
   * screen area, and the spec caps it at 4%. A crab's lit sprite cells cover
   * about 0.63 square world units; the squid's, the smallest, about 0.35. An
   * 0.11 x 0.11 dot is 0.0121 square units, which is 1.9% of the crab and
   * 3.5% of the squid. Both inside the cap, and the same physical size on
   * every species — a bigger ship gets a proportionally *smaller* accent,
   * which is what stops the wide octopus rows dominating the frame's light.
   *
   * ### One draw call in three colours
   *
   * Three's built-in `instanceColor` multiplies only the diffuse term, so it
   * cannot tint an emitter. `applyInstanceTint` injects a custom `instanceTint`
   * attribute that multiplies `totalEmissiveRadiance` as well, which is what
   * lets one instanced mesh render cyan, violet and magenta accents in a
   * single draw with each of them blooming in its own colour.
   */
  _buildEyes() {
    const geometry = createRoundedBox(EYE_SIZE, EYE_SIZE, 0.07, EYE_SIZE * 0.3, 2);
    this.disposer.track(geometry);

    // Species tint by *lattice index*, resolved once. The instance buffer is
    // written by draw slot and the formation compacts as it dies, so the two
    // indexings diverge the moment the first invader is killed; keeping the
    // authored table separate is what makes the per-frame copy a two-line
    // memcpy rather than a colour lookup inside the hot loop.
    this.tintByIndex = new Float32Array(FORMATION.COUNT * 3);
    const colour = new THREE.Color();
    for (let index = 0; index < FORMATION.COUNT; index++) {
      colour.set(SPECIES[ROW_SPECIES[rowOf(index)]].emissive);
      this.tintByIndex[index * 3 + 0] = colour.r;
      this.tintByIndex[index * 3 + 1] = colour.g;
      this.tintByIndex[index * 3 + 2] = colour.b;
    }
    const tintAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(this.tintByIndex),
      3
    );
    tintAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('instanceTint', tintAttribute);

    const material = this.materials.get('siInvaderEye', () => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        // 2.1 — well above the 1.368 floor. This is the formation's entire
        // contribution to the bloom buffer.
        emissiveIntensity: 2.1,
        roughness: 0.28,
        metalness: 0
      });
      return applyInstanceTint(mat, 'si-invader-eye');
    });

    const mesh = new THREE.InstancedMesh(geometry, material, FORMATION.COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
    this.eyes = mesh;
    this.eyeTints = tintAttribute;
    this.triangles += triangleCount(geometry) * FORMATION.COUNT;

    this.disposer.trackFn(() => {
      this.scene.remove(mesh);
      mesh.dispose();
    });
  }

  /* ================================================================== *
   * Per-frame
   * ================================================================== */

  /**
   * Read the formation out of `SimState` and write instance matrices.
   *
   * One pass over the 55 lattice slots. Dead invaders are skipped and the
   * per-species counters are what set each mesh's `count`, so a thinning
   * formation costs progressively less to draw with no compaction step and no
   * per-frame allocation.
   *
   * @param {number} dt      seconds since the last frame, unscaled
   * @param {object} state   the simulation state, read only
   */
  update(dt, state) {
    this.time += dt;

    const formation = state.formation;

    // Swap the pose geometry when the march step toggles it. Both geometries
    // stay allocated; this is a reference assignment, not a rebuild.
    if (formation.animFrame !== this.pose) {
      this.pose = formation.animFrame ? 1 : 0;
      for (const entry of this.species) {
        entry.mesh.geometry = entry.poses[this.pose];
      }
    }

    // Warp-in. `warpT` runs 0..1 across the whole staggered entrance, so an
    // individual invader's local progress has to be unwrapped from it: the
    // entrance lasts one WARP_DURATION plus the accumulated stagger, and each
    // index starts that many seconds late.
    const totalWarp = FORMATION.WARP_DURATION + FORMATION.COUNT * FORMATION.WARP_STAGGER;
    const warpClock = formation.warping ? formation.warpT * totalWarp : Infinity;

    let eyeCount = 0;

    for (let s = 0; s < this.species.length; s++) {
      const entry = this.species[s];
      const indices = this.speciesIndices[s];
      const species = SPECIES[s];
      const eyeOffsetY = species.height * EYE_HEIGHT_FRACTION;
      let drawn = 0;

      for (let i = 0; i < indices.length; i++) {
        const index = indices[i];
        if (!formation.alive[index]) continue;

        const col = columnOf(index);
        const row = rowOf(index);
        const x = invaderX(formation, col);
        const y = invaderY(formation, row);

        // Idle bob. The phase is derived from the lattice position rather than
        // from a random seed, so the formation ripples diagonally instead of
        // shimmering — a coherent wave reads as a swarm, uncorrelated noise
        // reads as a rendering fault.
        const phase = col * 0.55 + row * 0.9;
        const bobY = Math.sin(this.time * FORMATION.BOB_SPEED + phase) * FORMATION.BOB_AMPLITUDE;
        const bobZ =
          Math.sin(this.time * FORMATION.BOB_Z_SPEED + phase * 0.6) * FORMATION.BOB_Z_AMPLITUDE;

        let scale = 1;
        let spin = 0;
        if (warpClock !== Infinity) {
          const local = saturate((warpClock - index * FORMATION.WARP_STAGGER) / FORMATION.WARP_DURATION);
          if (local <= 0) {
            // Not yet arrived. Skipping the write leaves a stale matrix in the
            // buffer, so the instance is excluded by the count instead — which
            // is why the loop writes into `drawn` rather than into `i`.
            continue;
          }
          // A slight overshoot on arrival. The craft snaps past its final size
          // and settles, which is what makes a warp-in read as materialising
          // rather than as fading up.
          scale = easeOutBack(local, 1.9);
          spin = (1 - local) * (1 - local) * Math.PI * 1.6;
        }

        this._position.set(x, y + bobY, bobZ);
        this._euler.set(0, spin, 0);
        this._quaternion.setFromEuler(this._euler);
        this._scale.set(scale, scale, scale);
        this._matrix.compose(this._position, this._quaternion, this._scale);
        entry.mesh.setMatrixAt(drawn, this._matrix);
        drawn++;

        // The eye rides the same transform, offset forward so it sits proud of
        // the hull face and is never occluded by it.
        this._position.set(x, y + bobY + eyeOffsetY * scale, bobZ + HULL_DEPTH * 0.62);
        this._matrix.compose(this._position, this._quaternion, this._scale);
        this.eyes.setMatrixAt(eyeCount, this._matrix);
        // The tint attribute is indexed by draw slot, the authored table by
        // lattice index. They agree only while the formation is intact.
        const target = eyeCount * 3;
        const source = index * 3;
        if (target !== source) {
          const tint = this.eyeTints.array;
          tint[target] = this.tintByIndex[source];
          tint[target + 1] = this.tintByIndex[source + 1];
          tint[target + 2] = this.tintByIndex[source + 2];
        }
        eyeCount++;
      }

      entry.mesh.count = drawn;
      if (drawn > 0) entry.mesh.instanceMatrix.needsUpdate = true;
    }

    this.eyes.count = eyeCount;
    if (eyeCount > 0) {
      this.eyes.instanceMatrix.needsUpdate = true;
      this.eyeTints.needsUpdate = true;
    }
  }
}
