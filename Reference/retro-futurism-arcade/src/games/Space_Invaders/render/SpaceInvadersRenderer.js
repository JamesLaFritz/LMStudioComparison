import * as THREE from 'three';
import { ARENA, FORMATION, RENDER } from '../config.js';
import { CameraRig } from '@shared/render/CameraRig.js';
import { PostFX } from '@shared/render/PostFX.js';
import { minimumGlowIntensity } from '@shared/render/BloomPreset.js';
import { MaterialLibrary } from '@shared/procgen/MaterialLibrary.js';
import { Disposer } from '@shared/core/Disposer.js';
import { clamp, saturate } from '@shared/util/MathUtils.js';

import { ArenaRenderer } from './ArenaRenderer.js';
import { StarField } from './StarField.js';
import { InvaderField } from './InvaderField.js';
import { PlayerRenderer } from './PlayerRenderer.js';
import { ProjectileRenderer } from './ProjectileRenderer.js';
import { BunkerField } from './BunkerField.js';
import { UfoRenderer } from './UfoRenderer.js';

/**
 * The whole visual layer of Space Invaders, assembled.
 *
 * ### The contract with the simulation
 *
 * This class **reads** `SimState` and **writes** matrices, uniforms and
 * material properties. It never mutates a single field of the state, never
 * derives an entity position by any means other than the lattice helpers the
 * state itself exports, and imports nothing from the simulation except those
 * helpers. Two things fall out of holding that line:
 *
 *  - **Context loss is survivable.** When the GPU drops the context every
 *    mesh, material and texture is gone, and none of the *game* is, because
 *    none of it was ever stored on the GPU side. `rebuild()` reconstructs this
 *    entire object against the same live state and play continues from the
 *    same tick.
 *  - **The sprites cannot drift from the hitboxes.** Every invader position
 *    comes from `invaderX` / `invaderY`; every bunker cell from `gridToWorld`.
 *    There is no second copy of that arithmetic anywhere in this folder.
 *
 * ### What the frame is made of, in draw calls
 *
 * | Draws | What |
 * |---|---|
 * | 3 | star layers, 530 instances |
 * | 1 | nebula |
 * | 1 | deck and grid floor |
 * | 1 | silhouette skyline |
 * | 4 | arena rails and kill line |
 * | 6 | invader hulls and rims, 3 species x 2 geometry groups |
 * | 1 | 55 invader eye dots |
 * | 1 | 1,408 bunker cells |
 * | 2 | player hull and trim |
 * | 1 | player thruster |
 * | 1 | player bolts |
 * | 1 | enemy bombs |
 * | 2 | mystery ship and beam |
 *
 * Roughly **25 draw calls** against the config's budget of 60, and about two
 * thousand individually-lit elements before the particle system spawns
 * anything — which is the point. The reference's density comes from thousands
 * of small lit things, and a 500-particle cap cannot produce that; instancing
 * can.
 *
 * ### The tonal contract, stated once
 *
 * Two thirds of the frame below sRGB V 0.35. Under 1% of it white. The dark
 * teal and *more* saturated than the light. Every material in this folder is
 * authored to that, and it is checkable: `tools/measure-frame.py` in the
 * visual-target pack reports the ten numbers with the reference's p10-p90
 * envelope beside each.
 */

/** Far plane. The nebula sits at z -40 and the camera at +24.5. */
const CAMERA_FAR = 240;
const CAMERA_NEAR = 0.1;

/**
 * How far the shot pans down at full tension, world units.
 *
 * Solved, not chosen. See `_updateCamera`: it is the value that holds the
 * bottom of the frame at y -9.9 or lower across the whole tension range, which
 * is what keeps the player's cannon on screen while the camera closes in.
 */
const TENSION_PAN_Y = -2.0;

export class SpaceInvadersRenderer {
  /**
   * @param {object} opts
   * @param {THREE.WebGLRenderer} opts.renderer session renderer, never owned here
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {boolean} [opts.reducedMotion]
   * @param {number} [opts.boltCapacity] from `SimState`'s bolt pool
   */
  constructor({ renderer, width = 1920, height = 1080, reducedMotion = false, boltCapacity = 4 }) {
    this.renderer = renderer;
    this.reducedMotion = reducedMotion;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.time = 0;

    this.disposer = new Disposer('SpaceInvadersRenderer');
    this.scene = new THREE.Scene();
    this.materials = new MaterialLibrary(this.disposer);

    this.camera = new THREE.PerspectiveCamera(
      RENDER.FOV,
      this.width / this.height,
      CAMERA_NEAR,
      CAMERA_FAR
    );
    this.rig = new CameraRig(this.camera);
    this.rig
      .setBase(RENDER.CAMERA_BASE.x, RENDER.CAMERA_BASE.y, RENDER.CAMERA_BASE.z)
      .setTarget(RENDER.CAMERA_TARGET.x, RENDER.CAMERA_TARGET.y, RENDER.CAMERA_TARGET.z)
      .setBaseFov(RENDER.FOV)
      .teleport();

    this._buildLighting();

    const deps = { scene: this.scene, materials: this.materials, disposer: this.disposer };
    this.arena = new ArenaRenderer(deps);
    this.stars = new StarField(deps);
    this.invaders = new InvaderField(deps);
    this.bunkers = new BunkerField(deps);
    this.player = new PlayerRenderer(deps);
    this.projectiles = new ProjectileRenderer({ ...deps, boltCapacity });
    this.ufo = new UfoRenderer(deps);

    this.postfx = new PostFX(this.renderer, this.scene, this.camera, {
      bloomPreset: 'spaceInvaders',
      bloomOverrides: RENDER.BLOOM,
      reducedMotion,
      // Both must stay subthreshold: if a still frame lets you *name* either
      // effect, both are too strong. The reference corpus has no frame in
      // which grain is visible in the near-black, and our near-black is two
      // thirds of the screen — precisely where grain shows worst.
      // `base` is the resting corner offset as a fraction of screen width and
      // `peak` is where trauma takes it. 0.0011 is under the 0.0018 ceiling the
      // spec sets for a still frame, and the peak is only reached during a
      // convulsion nobody is reading detail through.
      chromatic: { base: 0.0011, peak: 0.0042, falloff: 2.2 },
      grain: { grain: 0.02, scanline: 0.03, vignette: 0.66 }
    });
    this.setSize(this.width, this.height);

    /** The emissive value a material must exceed to bloom. Reported, not used. */
    this.glowFloor = minimumGlowIntensity(RENDER.BLOOM.threshold);

    /** Last observed march step index, so the deck pulses once per step. */
    this._lastStepIndex = -1;
    /** Smoothed formation descent, driving the tension dolly. */
    this._tension = 0;
  }

  /* ================================================================== *
   * Lighting
   * ================================================================== */

  /**
   * Four static lights, and no shadow casters.
   *
   * ### Why the ambient is so low
   *
   * A hemisphere light is the fastest way to lift an entire frame off the
   * floor of the tonal contract, and 0.32 is about a third of what a scene
   * like this would normally carry. It is set there because the contract wants
   * two thirds of the pixels below sRGB V 0.35 and the deck alone covers most
   * of the lower half of the frame — every extra tenth of ambient is another
   * few percent of the screen lifted out of the dark band.
   *
   * The sky colour is the fog's teal and the ground colour is the void's
   * near-black, so unlit surfaces are tinted by the same atmosphere everything
   * else recedes into. That is what produces the reference's most distinctive
   * and most-missed property: the shadows carry *more* saturation than the
   * highlights.
   *
   * ### Why there are no shadows
   *
   * `RendererFactory` enables the shadow map, and nothing here casts into it.
   * The only surface that could receive a shadow is the deck, which sits 9.9
   * units below a play plane where every object is a flat extruded sprite, so
   * the shadows would be a row of identical dark rectangles on a floor the
   * player never looks at, for a full extra depth pass over the whole scene.
   * Stated explicitly because "shadows are off" reads as an oversight and this
   * one is a decision.
   */
  _buildLighting() {
    // Sky is the *measured shadow band* rather than the fog colour, and it is
    // the fix for the second-most-missed property of the reference. Measured
    // against the corpus, this frame's shadows came out at 95% saturation
    // where the reference sits at 49-87%: pure teal with the red channel at
    // 2/255. The reference's shadow is #0d2224 — teal, but with a real red
    // component — and lighting the dark with a colour that has none is what
    // produces a shadow no photograph ever contains.
    const hemi = new THREE.HemisphereLight(RENDER.DECK, 0x0a0806, 0.24);
    this.scene.add(hemi);

    // A floor under the black. The reference's deepest black is #030906, not
    // #000000 — even its darkest pixels carry a little green-led colour, which
    // is what atmosphere does. Without this the unlit parts of the frame clamp
    // to pure black, `black_hex` measures #000000, and the frame reads as
    // cut-out rather than as a dark room.
    const ambient = new THREE.AmbientLight(0x1a3a30, 0.1);
    this.scene.add(ambient);

    // Key: front-upper-left, cool white. This is what puts a bright face and a
    // dark face on every voxel and makes the hulls read as lit matter.
    const key = new THREE.DirectionalLight(0xbfe8ff, 1.5);
    key.position.set(6.5, 9, 8);
    this.scene.add(key);

    // Fill: from below and to the right, in the palette's own band, at under a
    // third of the key. It keeps the underside of a hull from going to pure
    // black without ever competing for the direction of the light.
    const fill = new THREE.DirectionalLight(0x2f7f92, 0.4);
    fill.position.set(-7, -4, 6);
    this.scene.add(fill);

    // Back rim: behind the play plane, at the measured haze colour. It
    // separates the formation's silhouette from the nebula, which is the one
    // job a light can do that the geometric outline cannot — the outline is a
    // constant, and this varies with facing.
    const rim = new THREE.DirectionalLight(RENDER.HAZE, 0.55);
    rim.position.set(-2, 6, -9);
    this.scene.add(rim);

    this.lights = { hemi, ambient, key, fill, rim };
    this.disposer.trackFn(() => {
      for (const light of [hemi, ambient, key, fill, rim]) {
        this.scene.remove(light);
        light.dispose();
      }
    });
  }

  /* ================================================================== *
   * Per-frame
   * ================================================================== */

  /**
   * Read the state and update everything visual.
   *
   * Driven by the **unscaled** delta. Hit-stop dilates the simulation clock,
   * and a camera or a starfield that freezes with the world makes a freeze
   * frame read as a crash rather than as an impact — the whole point of a
   * hit-stop is that the *world* stops and the presentation does not.
   *
   * @param {number} unscaledDt real seconds since the last frame
   * @param {object} state      simulation state, read only
   */
  update(unscaledDt, state) {
    this.time += unscaledDt;

    const formation = state.formation;

    // The deck beats once per march step, so the floor's pulse rate is the
    // formation's tempo and accelerates with it as the wave thins out.
    if (formation.stepIndex !== this._lastStepIndex) {
      const first = this._lastStepIndex < 0;
      this._lastStepIndex = formation.stepIndex;
      if (!first) this.arena.pulse(0.55);
    }

    this._updateCamera(unscaledDt, state);

    const parallaxX = this.camera.position.x - RENDER.CAMERA_BASE.x;
    this.arena.update(unscaledDt, state);
    this.arena.setParallax(parallaxX);
    this.stars.update(unscaledDt, parallaxX);
    this.invaders.update(unscaledDt, state);
    this.bunkers.update(state);
    this.player.update(unscaledDt, state);
    this.projectiles.update(unscaledDt, state);
    this.ufo.update(unscaledDt, state);

    this.postfx.update(unscaledDt);
  }

  /**
   * Camera drift, and the tension dolly.
   *
   * Two contributions, both registered as *named* offsets on the rig rather
   * than written to the camera directly. Nothing in this project writes
   * `camera.position`; the rig composes named contributions in a fixed order
   * once per frame, so two systems fighting over the camera shows up as two
   * named entries instead of as a jitter nobody can reproduce.
   *
   *  - **Parallax.** The camera drifts with the player at 11% of their motion,
   *    which is enough to make the starfield slide and the arena rails move
   *    against the formation, and far too little to read as camera movement.
   *  - **Tension.** As the formation descends the camera closes 3.2 units and
   *    narrows 3.5 degrees. Nobody notices; everybody feels it.
   *
   * ### The dolly has to pan down, and that is not decoration
   *
   * Both tension terms zoom *in*: closing 3.2 units and narrowing 3.5 degrees
   * together take about 20% off the visible height. At the frozen camera the
   * player's rail already sits within 0.6 world units of the bottom of the
   * frame — visible height at the play plane is 20.8 units centred on y 0.4,
   * so the bottom edge is y -10.0 and the cannon's underside is y -9.4 — and a
   * quarter of the tension is enough to push it off screen entirely. The first
   * capture taken from this renderer had no player in it for exactly that
   * reason, and nothing about the frame looked wrong; the ship was simply
   * absent.
   *
   * So the shot pans down as it tightens. Camera and target drop together by
   * `TENSION_PAN_Y` times the tension, which translates the whole view rather
   * than tilting it, and the value is solved rather than chosen: at 2.0 the
   * bottom edge stays between y -9.88 and y -10.0 across the entire tension
   * range, so the cannon keeps a constant sliver of headroom under it no
   * matter how far the formation has descended. It also happens to be the
   * right camera — as the fight moves down the screen, the camera follows it.
   */
  _updateCamera(unscaledDt, state) {
    const parallax = state.player.x * RENDER.PARALLAX_X;
    this.rig.setOffset('parallax', parallax, 0, 0);
    this.rig.setRoll('parallax', -state.player.vx * RENDER.PARALLAX_ROLL);

    // How far the formation has come down, 0 at spawn, 1 at the kill line.
    const spawnTop = FORMATION.SPAWN_TOP_Y;
    const travelled = saturate(
      (spawnTop - state.formation.originY) / Math.max(1, RENDER.TENSION_SPAN)
    );
    // Smoothed, because `originY` steps discretely on a formation drop and an
    // unsmoothed dolly would jerk the camera on every one of them.
    this._tension += (travelled - this._tension) * Math.min(1, unscaledDt * 2.2);

    const pan = TENSION_PAN_Y * this._tension;
    this.rig.setOffset('tension', 0, pan, RENDER.TENSION_DOLLY_Z * this._tension);
    // The rig moves the look target by 35% of any positional offset, which is
    // what makes a shake read as a jolt. A pan is not a jolt, so the remaining
    // 65% is applied to the target directly and the view translates instead of
    // tilting.
    this.rig.setTarget(
      RENDER.CAMERA_TARGET.x,
      RENDER.CAMERA_TARGET.y + pan * 0.65,
      RENDER.CAMERA_TARGET.z
    );
    this.rig.setFovOffset('tension', RENDER.TENSION_FOV * this._tension);

    this.rig.update(unscaledDt);
  }

  /* ================================================================== *
   * Plumbing
   * ================================================================== */

  render() {
    this.postfx.render();
  }

  setSize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.postfx.setSize(this.width, this.height);
  }

  /** Forward a trauma level to the aberration pass. */
  setTrauma(trauma) {
    this.postfx.setTrauma(clamp(trauma, 0, 1));
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
    this.postfx.setReducedMotion(enabled);
  }

  setQualityTier(tier) {
    this.postfx.setQualityTier(tier);
  }

  /**
   * Live bloom tuning, exposed so the visual-target measurement loop is a
   * session with a slider rather than a rebuild each time.
   *
   * The acceptance criterion is the measured halo profile, not the three
   * numbers: a tight bright core, half-power inside about 0.74% of frame
   * height, with a long faint skirt still at 7% of core brightness eight
   * frame-height-percent away. If the halo comes out too wide, drop
   * `bloomDivisor` from 2 to 1 *before* reducing radius below 0.38 — the
   * divisor renders bloom at half resolution and by itself doubles the
   * kernel's screen-space width, so it is the cleanest tightening available.
   */
  setBloom(values) {
    this.postfx.setBloom(values);
  }

  /**
   * Render bloom at full resolution instead of half.
   * @param {number} divisor 1 or 2
   */
  setBloomDivisor(divisor) {
    this.postfx.bloomDivisor = Math.max(1, divisor);
    this.postfx.bloomPass.setSize(
      this.width / this.postfx.bloomDivisor,
      this.height / this.postfx.bloomDivisor
    );
  }

  /** Counts for the debug panel's budget assertions. */
  stats() {
    return {
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      materials: this.materials.size,
      stars: this.stars.count,
      bunkerCells: this.bunkers.drawn,
      glowFloor: this.glowFloor
    };
  }

  /**
   * Full teardown.
   *
   * `PostFX` first, because its passes own render targets that must be freed
   * before the composer's own buffers go; then the material library, which
   * owns every texture; then the ledger, which runs every remaining teardown
   * in reverse creation order. The scene is cleared last so nothing is
   * traversed after its geometry has been released.
   */
  dispose() {
    this.postfx.dispose();
    this.materials.dispose();
    this.disposer.disposeAll();
    this.scene.clear();
  }
}
