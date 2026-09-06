import * as THREE from 'three';
import { ARENA, RENDER, PALETTE } from '../config.js';
import { makeGridTexture, makeNebulaTexture, releaseSource } from '@shared/procgen/TextureFactory.js';
import { normalFromHeight, roughnessFromHeight } from '@shared/procgen/PBRMaps.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyScanSweep } from '@shared/procgen/MaterialLibrary.js';
import { PRNG } from '@shared/procgen/PRNG.js';
import { clamp, saturate } from '@shared/util/MathUtils.js';

/**
 * The world the game happens in front of: void, fog, nebula, deck, grid floor,
 * a silhouette skyline and the two arena rails.
 *
 * ### This module is where the frame's tonal contract is won or lost
 *
 * Measured across 26 frames of the visual reference, half the frame is
 * essentially black (median linear luminance 0.028), two thirds of it sits
 * below sRGB V 0.35, and under 1% of it is white. Everything in here is sized
 * and coloured to land inside that envelope, because the arena is the only
 * thing on screen that covers a large area — the player, the formation and the
 * projectiles together occupy a few percent of the pixels. If the background
 * is a bright field, no amount of care with the foreground rescues the frame.
 *
 * Three decisions carry most of that:
 *
 *  1. **The dark is teal, not blue-violet.** `FogExp2` at `#0b1e22`. The
 *     reference's near-black is green-led with red crushed, ramping to
 *     teal-cyan as it lifts, and it was measured identically off two sources
 *     with different re-encode pipelines. The inherited `#05060f` is
 *     blue-violet — blue channel highest, green almost absent — and it is a
 *     visible, one-line difference.
 *  2. **The void is not teal.** The reference's dark is a city under
 *     atmosphere; ours is partly empty space, and a green-black void reads as
 *     a colour bug rather than as air. So the clear colour stays near-neutral
 *     `#03060a` and the teal lives in the fog, where it tints everything that
 *     recedes.
 *  3. **Nothing large emits above the bloom threshold.** The nebula fills up
 *     to a third of the frame at emissive 0.18; the deck's minor grid lines
 *     sit at 0.35; the skyline at 0.05. Only the major grid line, one every
 *     five, is allowed through at 1.9. A backdrop that blooms fogs the
 *     playfield and destroys projectile readability, which is the whole reason
 *     the threshold-based selective-bloom contract exists.
 */

/** Grid tile size in world units. One texture tile spans this much floor. */
const GRID_TILE = 10;
/** Minor lines per tile — one per world unit. */
const GRID_CELLS = 10;
/** Every fifth line is a major. */
const GRID_MAJOR_EVERY = 5;

/** Deck extent. Generous, because the horizon must be fog and never an edge. */
const DECK_HALF_WIDTH = 46;
const DECK_DEPTH_BACK = -52;
const DECK_DEPTH_FRONT = 16;

/**
 * The three depth bands of the city behind the arena.
 *
 * Heights are capped well under the formation's spawn line so the skyline
 * never rises into the playfield: a block that reaches the invaders reads as
 * an obstacle rather than as distance, and the arena has to stay legible. The
 * near band is the shortest for the same reason.
 */
/**
 * Floating lamp orbs: the frame's principal isolated point emitters.
 *
 * The radius is set by the measurement, not by taste. See `_buildLampOrbs`.
 */
const LAMP_RADIUS = 0.3;
/**
 * Fifteen, not thirty-eight.
 *
 * Thirty-eight passed every number in the envelope and looked wrong: a field
 * of white blobs hanging in front of the city, competing with the formation
 * for the eye and reading as an effect rather than as a place. The reference's
 * quiet plate carries about fifteen orb lamps and they belong to the
 * architecture. This is the count that satisfies the halo measurement and the
 * blowout budget without the frame becoming about them — which is the whole
 * difference between hitting a metric and hitting the target.
 */
const LAMP_COUNT = 15;

const SKYLINE_BANDS = Object.freeze([
  Object.freeze({ z: ARENA.BACK_Z, blocks: 26, halfWidth: 30, minHeight: 0.8, maxHeight: 5.2 }),
  Object.freeze({ z: -22, blocks: 30, halfWidth: 38, minHeight: 1.4, maxHeight: 8.5 }),
  Object.freeze({ z: -34, blocks: 34, halfWidth: 46, minHeight: 2.0, maxHeight: 12.0 })
]);

export class ArenaRenderer {
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

    this.rng = new PRNG('space-invaders-arena');
    this.time = 0;

    /** Emissive pulse on the grid, driven by the formation's march. */
    this.gridPulse = 0;
    /** Sweep position, world Y, wrapping up the deck. */
    this.sweepY = ARENA.FLOOR_Y;

    /** @type {{setSweep:(y:number)=>void, setPulse:(v:number)=>void}|null} */
    this.deckSweep = null;

    this._applyAtmosphere();
    this._buildNebula();
    this._buildDeck();
    this._buildSkyline();
    this._buildKillLine();
  }

  /* ================================================================== *
   * Construction
   * ================================================================== */

  /**
   * Clear colour and fog.
   *
   * `scene.background` rather than `renderer.setClearColor` on purpose: the
   * renderer is session-wide and shared with the hub and every other cabinet,
   * so a game that writes to it leaks its own art direction into everything
   * mounted after it. A background colour on the scene is scoped to the scene.
   */
  _applyAtmosphere() {
    const background = new THREE.Color(RENDER.VOID);
    this.scene.background = background;
    this.scene.fog = new THREE.FogExp2(RENDER.FOG, RENDER.FOG_DENSITY);
    // FogExp2 has no dispose; clearing the references is the whole teardown.
    this.disposer.trackFn(() => {
      this.scene.background = null;
      this.scene.fog = null;
    });
  }

  /**
   * One plane far behind everything, carrying an fBm cloud field.
   *
   * Authored at emissive 0.18 with roughness 1.0 and `fog: false`. It is the
   * largest single surface in the frame and it must contribute *nothing* to
   * the bloom buffer — the `pow(density, 5)` core term inside the texture is
   * what lets the densest filaments still read as structure while the bulk of
   * the field sits far below the threshold. `depthWrite: false` and a negative
   * `renderOrder` keep it from ever occluding the playfield.
   */
  _buildNebula() {
    const { texture } = makeNebulaTexture({
      size: 1024,
      seed: 481207,
      scale: 2.4,
      octaves: 5,
      // ### These are the numbers that set the frame's median luminance
      //
      // The nebula is the sky, and the sky is most of the frame's *area*, so
      // whatever the sky sits at is roughly what the frame's median pixel sits
      // at. Authored near-black — sRGB bytes of 3, 6, 7 — the median linear
      // luminance measured 0.002 against a reference envelope of 0.011-0.057,
      // and 92% of pixels fell below sRGB V 0.35 against a ceiling of 86%. The
      // frame was not too dark in its *lighting*; it was empty.
      //
      // These values are worked backwards from the spec's ruling that the
      // nebula's peak brightness is the measured haze band #1c4046. At an
      // emissive intensity of 0.18 the texture has to carry roughly 0.6 in
      // sRGB to land there, so `high` is set to that and `low` a third of it.
      // The whole sky then sits between sRGB V 0.10 and V 0.27 — comfortably
      // inside the "dark" band the tonal contract counts, and comfortably
      // above black.
      //
      // The hue stays inside 150-210 degrees. Magenta is reserved for threat
      // and budgeted at under 8% of lit pixels, which a full-frame backdrop
      // would blow instantly, so the default magenta core is replaced.
      low: [0.055, 0.115, 0.128],
      high: [0.33, 0.57, 0.6],
      core: [0.4, 0.86, 0.96],
      coreStrength: 0.4,
      filamentStrength: 0.34,
      contrast: [0.36, 0.92]
    });
    this.disposer.track(texture);

    const surface = RENDER.SURFACE.nebula;
    const material = this.materials.get('siNebula', () =>
      new THREE.MeshStandardMaterial({
        color: 0x040a0c,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: surface.emissiveIntensity,
        roughness: surface.roughness,
        metalness: surface.metalness,
        depthWrite: false,
        fog: false
      })
    );

    // Sized to overfill the frustum at its depth: the camera sits at z 24.5
    // with a 46-degree vertical FOV, so at z -40 the visible height is
    // 2 * 64.5 * tan(23) = 54.8 units and the width at 21:9 is 128.
    const geometry = new THREE.PlaneGeometry(150, 68);
    this.disposer.track(geometry);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 1.5, ARENA.NEBULA_Z);
    mesh.renderOrder = -20;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.nebula = mesh;

    releaseSource(texture);
    this.disposer.trackFn(() => this.scene.remove(mesh));
  }

  /**
   * The deck and its grid floor.
   *
   * The grid is a Canvas-drawn emissive map, not geometry, for a specific
   * reason: as line geometry it would be several hundred thin quads fighting
   * the depth buffer at grazing angles, and the far end of it would alias into
   * a shimmering mess. As a mip-mapped, anisotropically-filtered texture the
   * far end resolves into smooth haze and meets the fog cleanly, which is
   * exactly the horizon treatment the reference shows.
   *
   * The emissive map carries the brightness split by itself. The material's
   * `emissiveIntensity` is the major line's value, 1.9, and the minor line's
   * colour is dark enough in the texture that the product lands at roughly
   * 0.26 luminance — comfortably under the 0.72 bloom threshold. So one line
   * in five blooms and the rest is structure. That is a texture-authoring
   * decision, and it is the reason the grid can be dense without hazing.
   */
  _buildDeck() {
    const { texture, height, size } = makeGridTexture({
      size: 512,
      cells: GRID_CELLS,
      majorEvery: GRID_MAJOR_EVERY,
      minorWidth: 1.0,
      majorWidth: 2.2,
      // Black, not the deck colour: this feeds `emissiveMap`, and anything
      // non-black in it becomes light emitted by bare floor.
      background: '#000000',
      // Two thirds down from `PALETTE.GRID`. The palette value is the *line's*
      // colour; what goes in an emissive map is the line's colour times its
      // brightness, and at the palette value the minor grid measured as a
      // visible cyan lattice across the whole lower third of the frame,
      // holding `pct_dark_V_lt_035` five points under the reference floor. The
      // major line, one in five, still carries the palette hue at full
      // strength — which is the contrast the grid is actually made of.
      minorColor: '#0d3348',
      majorColor: '#57e2ff',
      // The halo pass exists so the emissive map has soft shoulders for the
      // bloom to catch. At 6 it was widening every minor line into a band;
      // the major lines are wide enough to bloom on their own.
      glow: 3
    });

    const repeatX = (DECK_HALF_WIDTH * 2) / GRID_TILE;
    const repeatY = (DECK_DEPTH_FRONT - DECK_DEPTH_BACK) / GRID_TILE;
    texture.repeat.set(repeatX, repeatY);
    this.disposer.track(texture);

    // The same heightfield drives a matching normal and roughness map, so the
    // grid lines are physically incised into the deck and catch the key light
    // rather than being a decal printed on a flat surface.
    const { texture: normalMap } = normalFromHeight(height, size, size, { strength: 1.6 });
    normalMap.repeat.set(repeatX, repeatY);
    this.disposer.track(normalMap);

    // Bright source (the lines) maps to *low* roughness, so the incised grid
    // reads as polished trim against matte deck plating under one light.
    const { texture: roughnessMap } = roughnessFromHeight(height, size, size, {
      low: 0.22,
      high: RENDER.SURFACE.deck.roughness + 0.16,
      invert: true
    });
    roughnessMap.repeat.set(repeatX, repeatY);
    this.disposer.track(roughnessMap);

    const surface = RENDER.SURFACE.deck;
    const base = new THREE.MeshStandardMaterial({
      color: RENDER.DECK,
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: RENDER.SURFACE.gridMajor.emissiveIntensity,
      normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap,
      roughness: surface.roughness,
      metalness: surface.metalness
    });

    // A slow emissive sweep travelling up the deck, plus a pulse the game
    // drives from `FORMATION.stepPeriod`. As the formation thins and
    // accelerates the floor pulses faster. Nobody notices; everybody feels it.
    this.deckSweep = applyScanSweep(base, {
      cacheKey: 'si-deck-sweep',
      width: 3.2,
      gain: 1.15,
      axisScale: 0.02
    });
    this.materials.register('siDeck', base);

    const geometry = new THREE.PlaneGeometry(
      DECK_HALF_WIDTH * 2,
      DECK_DEPTH_FRONT - DECK_DEPTH_BACK,
      1,
      1
    );
    geometry.rotateX(-Math.PI * 0.5);
    this.disposer.track(geometry);

    const mesh = new THREE.Mesh(geometry, base);
    mesh.position.set(0, ARENA.FLOOR_Y, (DECK_DEPTH_FRONT + DECK_DEPTH_BACK) * 0.5);
    mesh.receiveShadow = false;
    this.scene.add(mesh);
    this.deck = mesh;

    releaseSource(texture);
    releaseSource(normalMap);
    releaseSource(roughnessMap);
    this.disposer.trackFn(() => this.scene.remove(mesh));
  }

  /**
   * The city behind the arena: three depth bands of dark blocks, each carrying
   * small emissive window strips, plus a scattering of hot lamps.
   *
   * ### Why the backdrop got a building permit
   *
   * The first measured capture came out at Y_p50 0.002 against a reference
   * envelope of 0.011-0.057 and `pct_dark_V_lt_035` at 90% against a ceiling
   * of 86%. Both failures have the same cause and it is not a brightness
   * setting: the frame was *empty*. The reference's quiet plates are not empty
   * black with a few sprites on them — they are a dense voxel city under
   * atmosphere, full of mid-tone lit structure, with dozens of small hard
   * emitters scattered through it. Half of that frame being dark is a
   * statement about a *populated* scene.
   *
   * So this is the frame's mid-tone supply and its supply of isolated point
   * emitters, and it is also the reason the halo profile is measurable at all:
   * that metric needs small bright things with empty space around them, and
   * before this the only candidates were the starfield.
   *
   * ### Three tiers of light, again
   *
   * The same emissive contract the invaders use, for the same reason. Block
   * bodies at 0.05 are silhouette. Window strips at 0.55 are structure — they
   * describe the building without adding to the bloom buffer, and there are
   * several hundred of them, so anything above the threshold here would haze
   * the whole horizon. Roughly one window in twelve is promoted to a lamp at
   * 2.6, which does bloom, and those are the frame's point sources.
   *
   * Fog does the depth grading for free: the same materials at z -12, -22 and
   * -34 read as three distinct planes because `FogExp2` at 0.021 eats them at
   * different rates. Nothing here is authored per band except the geometry.
   *
   * Three draw calls: bodies, windows, lamps.
   */
  _buildSkyline() {
    /** @type {THREE.BufferGeometry[]} */
    const bodies = [];
    /** @type {THREE.BufferGeometry[]} */
    const windows = [];
    for (const band of SKYLINE_BANDS) {
      let cursor = -band.halfWidth;
      for (let i = 0; i < band.blocks; i++) {
        const width = this.rng.range(1.2, 3.6);
        const depth = this.rng.range(1.4, 3.8);
        const height = this.rng.range(band.minHeight, band.maxHeight);
        const cx = cursor + width * 0.5;
        const cz = band.z - this.rng.range(0, 4);
        const cy = ARENA.FLOOR_Y + height * 0.5;

        const box = new THREE.BoxGeometry(width, height, depth);
        box.translate(cx, cy, cz);
        bodies.push(box);

        // Window strips on the face that looks at the camera. Laid out on a
        // grid with gaps knocked out, because a fully-populated grid reads as
        // a texture and a sparse one reads as a building with people in it.
        const cols = Math.max(1, Math.floor(width / 0.42));
        const rows = Math.max(1, Math.floor(height / 0.62));
        const faceZ = cz + depth * 0.5 + 0.02;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (this.rng.next() > 0.52) continue;
            const wx = cx - width * 0.5 + (c + 0.5) * (width / cols);
            const wy = ARENA.FLOOR_Y + (r + 0.55) * (height / rows);
            const strip = new THREE.BoxGeometry(0.14, 0.3, 0.05);
            strip.translate(wx, wy, faceZ);
            windows.push(strip);
          }
        }

        cursor += width + this.rng.range(0.2, 1.5);
        if (cursor > band.halfWidth) break;
      }
    }

    const wall = RENDER.SURFACE.wall;
    // The block bodies emit at three times the spec's 0.05 silhouette value.
    //
    // 0.05 is the right number for *architecture in front of a lit sky*, which
    // is the situation the reference plate shows. Ours stands in front of a
    // nebula, in fog, with the key light aimed at the play plane twelve units
    // in front of it — so at 0.05 the city was a black cut-out, contributing
    // nothing but occlusion. At 0.16 with the measured haze colour it reads as
    // fog-lit concrete: still far under the 1.368 glow floor, still a
    // silhouette, but a silhouette with a surface.
    const bodyMaterial = this.materials.get('siSkyline', () =>
      new THREE.MeshStandardMaterial({
        color: 0x0b1c20,
        emissive: RENDER.HAZE,
        emissiveIntensity: 0.16,
        roughness: wall.roughness,
        metalness: wall.metalness
      })
    );
    const windowMaterial = this.materials.get('siSkylineWindow', () =>
      new THREE.MeshStandardMaterial({
        color: 0x0a2028,
        emissive: PALETTE.GRID_MAJOR,
        // Under the glow floor. There are several hundred of these and any one
        // of them above the threshold would put a haze across the horizon.
        emissiveIntensity: 0.55,
        roughness: 0.5,
        metalness: 0
      })
    );
    this.skyline = new THREE.Group();
    for (const [parts, material] of [
      [bodies, bodyMaterial],
      [windows, windowMaterial]
    ]) {
      if (!parts.length) continue;
      const merged = mergeParts(parts);
      this.disposer.track(merged);
      this.skyline.add(new THREE.Mesh(merged, material));
    }

    this.scene.add(this.skyline);
    this.disposer.trackFn(() => this.scene.remove(this.skyline));

    this._buildLampOrbs();
  }

  /**
   * Floating lamp orbs over the city.
   *
   * ### These exist because of one specific measurement
   *
   * `halo_r_half_pct` — the radius at which an isolated emitter's brightness
   * halves, as a percentage of frame height — is the spec's stated *gate* on
   * bloom, and the reference sits at 0.37-1.95% with a median of 0.74%, which
   * is eight pixels at 1080p. Sweeping bloom strength from 0.72 to 1.5 and
   * radius from 0.38 to 0.85 moved this build's value not at all: it stayed
   * pinned at 0.185%, the first radius the tool samples.
   *
   * The reason, once the reference plates are looked at rather than reasoned
   * about, is that **the reference's half-power radius is mostly the emitter,
   * not the bloom.** Its lamps are physically large glowing orbs a dozen or
   * more pixels across; bloom supplies the long faint skirt out at 3.7%, and
   * the tight core the profile describes is the object's own disc. A build
   * whose only isolated emitters are three-pixel stars cannot produce that
   * shape at any bloom setting, because there is no disc — and turning the
   * bloom up far enough to fake one would haze the entire frame.
   *
   * So the frame is given real orbs: 0.62 world units across, which is 3% of
   * the play plane's visible height and about sixteen pixels at 1080p at their
   * depth, scattered through the sky over the city with enough separation that
   * the measurement's isolation test can actually find them.
   *
   * ### Two departures, both deliberate
   *
   * They are **near-white**, `#cfeeff`, not saturated cyan. Partly because the
   * reference's own orbs are white-cored — the colour is in the halo, not the
   * middle — and partly because a near-white pixel has a saturation under the
   * 0.35 threshold at which the hue histogram counts it, so several dozen
   * bright orbs add luminance and blowout to the frame without spending any of
   * the narrow hue band's budget.
   *
   * They are **`fog: false`**, like the starfield. Physically, atmosphere does
   * dim a distant lamp, and at this fog density one at z -20 would lose 45% of
   * its brightness. But the fog colour is a mid-dark teal, so what fog actually
   * does to a small bright emitter here is not dim it — it *lifts its
   * surroundings toward the fog colour and flattens its contrast*, which is the
   * one thing the halo profile is measuring. Excluding them keeps the emitters
   * hard and lets the fog grade the architecture, which is where it reads.
   */
  _buildLampOrbs() {
    // 80 triangles. At sixteen pixels across, a two-subdivision icosahedron's
    // silhouette is indistinguishable from a sphere's and costs a twentieth of
    // the vertices.
    const geometry = new THREE.IcosahedronGeometry(LAMP_RADIUS, 2);
    this.disposer.track(geometry);

    const material = this.materials.get('siLampOrb', () =>
      new THREE.MeshStandardMaterial({
        color: 0xcfeeff,
        emissive: 0xcfeeff,
        // Well above `minimumGlowIntensity(0.72)` = 1.368. These are the
        // frame's principal bloom sources.
        emissiveIntensity: 2.6,
        roughness: 0.3,
        metalness: 0,
        fog: false
      })
    );

    const mesh = new THREE.InstancedMesh(geometry, material, LAMP_COUNT);
    mesh.frustumCulled = false;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    // Stratified across a coarse grid so no two orbs land on top of each other
    // and each one has empty sky around it. The isolation test the measurement
    // runs rejects any peak whose surroundings are still above 18% of its core,
    // so clustered orbs would measure nothing at all.
    const cols = 5;
    const rows = Math.ceil(LAMP_COUNT / cols);
    let placed = 0;
    for (let r = 0; r < rows && placed < LAMP_COUNT; r++) {
      for (let c = 0; c < cols && placed < LAMP_COUNT; c++) {
        // Held down over the city rather than spread through the sky. Orbs at
        // the formation's altitude read as objects in the playfield — the
        // player tries to shoot them — and they sit directly behind the
        // invaders, which is the one place in the frame that has to stay
        // legible.
        const x = ((c + 0.12 + this.rng.next() * 0.76) / cols - 0.5) * 72;
        const y = -8.6 + ((r + 0.1 + this.rng.next() * 0.8) / rows) * 8.2;
        const z = -13 - this.rng.next() * 17;

        position.set(x, y, z);
        // A modest size spread. Identical orbs read as a repeated sprite; a
        // distribution reads as depth.
        const s = this.rng.range(0.72, 1.35);
        scale.set(s, s, s);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(placed, matrix);
        placed++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = placed;

    this.scene.add(mesh);
    this.lamps = mesh;
    this.disposer.trackFn(() => {
      this.scene.remove(mesh);
      mesh.dispose();
    });
  }

  /**
   * The kill line.
   *
   * Reaching it loses the run outright regardless of remaining lives, so it is
   * the one piece of rule state the player cannot infer from anything else on
   * screen. It is drawn as a dashed strip at the *grid minor* emissive value —
   * deliberately inside the 150-210 degree band and deliberately below the
   * bloom threshold, because the obvious choice, a red warning line, would
   * spend the frame's entire threat-colour budget on a static element and
   * leave the bombs nothing to be alarming with.
   *
   * `setThreat` lifts it toward the major value as the formation closes, so it
   * gains urgency by brightening within its own hue rather than by changing
   * colour.
   */
  _buildKillLine() {
    const dashes = 34;
    const dashWidth = (ARENA.HALF_WIDTH * 2) / (dashes * 1.75);
    /** @type {THREE.BufferGeometry[]} */
    const parts = [];

    for (let i = 0; i < dashes; i++) {
      const t = (i + 0.5) / dashes;
      const x = -ARENA.HALF_WIDTH + t * ARENA.HALF_WIDTH * 2;
      const box = new THREE.BoxGeometry(dashWidth, 0.045, 0.045);
      box.translate(x, ARENA.KILL_LINE_Y, -0.9);
      parts.push(box);
    }

    const merged = mergeParts(parts);
    this.disposer.track(merged);

    const minor = RENDER.SURFACE.gridMinor;
    const material = this.materials.get('siKillLine', () =>
      new THREE.MeshStandardMaterial({
        color: 0x0b2630,
        emissive: PALETTE.GRID,
        emissiveIntensity: minor.emissiveIntensity,
        roughness: minor.roughness,
        metalness: minor.metalness
      })
    );
    this.killLineMaterial = material;
    this.killLineBaseIntensity = minor.emissiveIntensity;

    const mesh = new THREE.Mesh(merged, material);
    this.scene.add(mesh);
    this.killLine = mesh;
    this.disposer.trackFn(() => this.scene.remove(mesh));
  }

  /* ================================================================== *
   * Per-frame
   * ================================================================== */

  /**
   * @param {number} dt seconds since the last frame, unscaled
   * @param {object} state the simulation state, read only
   */
  update(dt, state) {
    this.time += dt;

    // The sweep travels up the deck and wraps. Speed is fixed; the *pulse* is
    // what carries tempo, because a sweep that accelerates would read as the
    // camera moving rather than as the game tightening.
    const travel = ARENA.HALF_HEIGHT * 2 + 6;
    this.sweepY += dt * RENDER.GRID_SWEEP_SPEED * travel;
    if (this.sweepY > ARENA.FLOOR_Y + travel) this.sweepY = ARENA.FLOOR_Y;

    this.gridPulse = Math.max(0, this.gridPulse - dt * RENDER.GRID_PULSE_DECAY);

    if (this.deckSweep) {
      this.deckSweep.setSweep(this.sweepY);
      this.deckSweep.setPulse(this.gridPulse);
    }

    if (state) {
      // Threat is how far the formation has closed the gap between its spawn
      // height and the kill line. 0 at spawn, 1 at the line.
      const top = state.formation.originY;
      const span = Math.max(0.001, ARENA.HEIGHT * 0.5 - ARENA.KILL_LINE_Y);
      const threat = saturate(1 - (top - ARENA.KILL_LINE_Y) / span);
      this.setThreat(threat);
    }

    // A very slow parallax drift on the backdrop, an order of magnitude below
    // anything the eye tracks. It stops the nebula reading as a printed
    // backdrop without ever being noticeable as motion.
    this.nebula.position.x = Math.sin(this.time * 0.031) * 1.1;
    this.nebula.position.y = 1.5 + Math.sin(this.time * 0.023) * 0.5;
    if (this.lamps) this.lamps.position.x = Math.sin(this.time * 0.024) * 0.6;
  }

  /**
   * Kick the floor's emissive pulse. Called on every march step, so the deck
   * beats at exactly the formation's tempo.
   * @param {number} [amount]
   */
  pulse(amount = 0.5) {
    this.gridPulse = Math.min(1.4, this.gridPulse + amount);
  }

  /**
   * Formation proximity to the kill line, 0..1. Brightens the kill line inside
   * its own hue rather than shifting it toward red.
   */
  setThreat(t) {
    const threat = clamp(t, 0, 1);
    if (!this.killLineMaterial) return;
    const major = RENDER.SURFACE.gridMajor.emissiveIntensity;
    // Held under the major value until the last third, then allowed through
    // the bloom threshold. The line only glows when it genuinely matters.
    const eased = threat * threat;
    this.killLineMaterial.emissiveIntensity =
      this.killLineBaseIntensity + (major - this.killLineBaseIntensity) * eased;
  }

  /** Camera parallax hook: shifts the far layers against the near ones. */
  setParallax(x) {
    this.nebula.position.x += x * 0.12;
    if (this.skyline) this.skyline.position.x = x * 0.35;
  }
}

/**
 * Merge a list of pre-translated geometries into one, disposing the sources.
 *
 * A thin local wrapper rather than `GeometryLab.mergeAndDispose` because the
 * arena bakes world translations into its parts before merging, and
 * `mergeAndDispose` recomputes and re-centres the bounding box — which would
 * lift the skyline off the back wall and slide the kill line off the kill
 * line. The merge itself is three.js's own `mergeGeometries`.
 */
function mergeParts(parts) {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) {
    throw new Error('ArenaRenderer: mergeGeometries failed (mismatched attributes).');
  }
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
