import * as THREE from 'three';
import { BOLT, BOMB, BOMB_TYPES, RENDER } from '../config.js';
import { createRoundedBox } from '@shared/procgen/GeometryLab.js';
import {
  applyNeonBolt,
  applyInstanceTintAndEnergy
} from '@shared/procgen/MaterialLibrary.js';
import { makeBoltGradientTexture, releaseSource } from '@shared/procgen/TextureFactory.js';
import { saturate } from '@shared/util/MathUtils.js';

/**
 * Player bolts and enemy bombs — the frame's actual light sources.
 *
 * ### These carry the light the hulls gave up
 *
 * With the formation authored as lit matter, the projectiles are most of what
 * is left above the bloom threshold, and that is exactly the reference's own
 * arrangement: in its formation plates the enemies are dark and the *tracers*
 * are what glow. So the budget is spent here without apology — the bolt at
 * 2.4, the bombs at 1.9 — and the frame still lands two thirds dark, because
 * a bolt is 0.11 world units wide, which is 0.53% of frame height, which is
 * six pixels at 1080p.
 *
 * That width is not a choice made here. `BOLT.RADIUS` was already 0.055 in the
 * frozen config, and the reference's median bright-feature width measures
 * 4-6 px at 1080p. The two agree to within a tenth of a percent of frame
 * height, which is a useful independent check that the existing scale
 * decisions were sound.
 *
 * ### Two instanced meshes, and the threat-colour budget
 *
 * Bolts are one `InstancedMesh`; bombs are another, with a per-instance tint
 * so the three archetypes — magenta plunger, amber squiggly, red rolling —
 * render in one draw call in three colours. Three's built-in `instanceColor`
 * would only tint the diffuse term and could not tint an emitter, so this uses
 * the shared `instanceTint` + `instanceEnergy` injection, which multiplies
 * `totalEmissiveRadiance` too.
 *
 * The energy channel is what fades a bomb as it nears the deck and what makes
 * a bolt brighten over its first few metres. Fading an emitter to black under
 * the bloom threshold is both cheaper than alpha and a better visual match for
 * something burning out: alpha fading needs a sorted transparent pass and
 * fights the depth buffer in a scene this bloom-heavy.
 *
 * Magenta and red are reserved for threat and are budgeted at **under 8% of
 * lit pixels combined**, shared with the mystery ship. Six bombs at 0.18 x
 * 0.52 world units is 0.56 square units against a visible play plane of
 * roughly 770, so a fully loaded screen of bombs is well inside it — the way
 * that budget gets blown is a magenta *backdrop*, not magenta projectiles.
 */

/** Bolt body dimensions, taken straight from the frozen config. */
const BOLT_RADIUS = BOLT.RADIUS;
const BOLT_LENGTH = BOLT.LENGTH;

/** Bomb body dimensions. `BOMB.HALF_WIDTH` / `HALF_HEIGHT` are the hitbox. */
const BOMB_WIDTH = BOMB.HALF_WIDTH * 2;
const BOMB_HEIGHT = BOMB.HALF_HEIGHT * 2;

export class ProjectileRenderer {
  /**
   * @param {object} deps
   * @param {THREE.Scene} deps.scene
   * @param {import('@shared/procgen/MaterialLibrary.js').MaterialLibrary} deps.materials
   * @param {import('@shared/core/Disposer.js').Disposer} deps.disposer
   * @param {number} deps.boltCapacity from `SimState`'s bolt pool
   */
  constructor({ scene, materials, disposer, boltCapacity = 4 }) {
    this.scene = scene;
    this.materials = materials;
    this.disposer = disposer;
    this.time = 0;

    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._scale = new THREE.Vector3(1, 1, 1);

    this._buildBolts(boltCapacity);
    this._buildBombs();
  }

  /* ================================================================== *
   * Construction
   * ================================================================== */

  /**
   * The player's bolt.
   *
   * A capped cylinder rather than a box, because the neon-bolt shader's
   * Fresnel term needs a surface whose normal actually sweeps through the
   * grazing angle to produce the "energy contained in a shell" read; on a flat
   * box face it would be a uniform tint. Eight radial segments is enough at
   * six pixels wide, and the difference between eight and thirty-two is
   * invisible and 4x the vertices.
   *
   * A longitudinal gradient texture supplies the hot white core and the darker
   * tail, so the bolt has a *direction* even in a still frame.
   */
  _buildBolts(capacity) {
    const geometry = new THREE.CylinderGeometry(BOLT_RADIUS, BOLT_RADIUS * 0.82, BOLT_LENGTH, 8, 1);
    this.disposer.track(geometry);

    const { texture } = makeBoltGradientTexture({
      size: 128,
      color: `#${new THREE.Color(BOLT.COLOR).getHexString()}`,
      coreBias: 0.6
    });
    this.disposer.track(texture);

    const surface = RENDER.SURFACE.bolt;
    const material = this.materials.get('siBolt', () => {
      const mat = new THREE.MeshStandardMaterial({
        color: BOLT.COLOR,
        emissive: BOLT.EMISSIVE,
        emissiveMap: texture,
        emissiveIntensity: surface.emissiveIntensity,
        roughness: surface.roughness,
        metalness: surface.metalness
      });
      // Fresnel rim plus a travelling core band. The band is what gives a
      // projectile a sense of velocity while it is nominally a rigid object.
      const handle = applyNeonBolt(mat, {
        cacheKey: 'si-bolt',
        rimPower: 2.0,
        rimGain: 1.6,
        baseGain: 0.7,
        coreGain: 1.9,
        scrollSpeed: 3.4,
        bandCount: 2.0,
        bandWidth: 0.4
      });
      this.boltShader = handle;
      return mat;
    });

    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
    this.bolts = mesh;

    releaseSource(texture);
    this.disposer.trackFn(() => {
      this.scene.remove(mesh);
      mesh.dispose();
    });
  }

  /**
   * The enemy bombs.
   *
   * One rounded box for all three archetypes, differentiated by tint, by roll
   * and by aspect. At this size — under three pixels wide at 1080p — a
   * distinct silhouette per archetype would be invisible, and the player reads
   * the difference from colour and motion, which are both free. The
   * unshootable rolling bomb gets the widest body and the fastest spin, so
   * that "do not try to intercept this one" is legible at a glance rather than
   * only after it fails to die.
   */
  _buildBombs() {
    const geometry = createRoundedBox(BOMB_WIDTH, BOMB_HEIGHT, BOMB_WIDTH * 0.7, BOMB_WIDTH * 0.3, 2);
    this.disposer.track(geometry);

    const tints = new Float32Array(BOMB.MAX * 3);
    const energies = new Float32Array(BOMB.MAX);
    energies.fill(1);
    const tintAttribute = new THREE.InstancedBufferAttribute(tints, 3);
    const energyAttribute = new THREE.InstancedBufferAttribute(energies, 1);
    tintAttribute.setUsage(THREE.DynamicDrawUsage);
    energyAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('instanceTint', tintAttribute);
    geometry.setAttribute('instanceEnergy', energyAttribute);
    this.bombTints = tintAttribute;
    this.bombEnergies = energyAttribute;

    // Archetype colours resolved to linear RGB once, so the per-frame path is
    // three array writes and never a colour parse.
    this.bombColours = BOMB_TYPES.map((type) => {
      const c = new THREE.Color(type.emissive);
      return [c.r, c.g, c.b];
    });

    const surface = RENDER.SURFACE.bomb;
    const material = this.materials.get('siBomb', () => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: surface.emissiveIntensity,
        roughness: surface.roughness,
        metalness: surface.metalness
      });
      return applyInstanceTintAndEnergy(mat, 'si-bomb');
    });

    const mesh = new THREE.InstancedMesh(geometry, material, BOMB.MAX);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
    this.bombs = mesh;

    this.disposer.trackFn(() => {
      this.scene.remove(mesh);
      mesh.dispose();
    });
  }

  /* ================================================================== *
   * Per-frame
   * ================================================================== */

  /**
   * @param {number} dt    seconds since the last frame, unscaled
   * @param {object} state simulation state, read only
   */
  update(dt, state) {
    this.time += dt;
    if (this.boltShader) this.boltShader.setTime(this.time);

    this._syncBolts(state);
    this._syncBombs(state);
  }

  _syncBolts(state) {
    const bolts = state.bolts;
    let drawn = 0;

    for (let i = 0; i < bolts.capacity; i++) {
      if (!bolts.active[i]) continue;

      // Stretch along the direction of travel. The bolt covers 0.28 world
      // units per 120Hz tick, which is more than four times its own radius, so
      // without this it reads as a static pip being teleported up the screen.
      // The stretch is capped so it never becomes a line.
      const dy = bolts.y[i] - bolts.prevY[i];
      const stretch = Math.min(2.2, 1 + Math.abs(dy) * 1.6);

      this._position.set(bolts.x[i], bolts.y[i], 0);
      this._scale.set(1, stretch, 1);
      this._matrix.compose(this._position, this._quaternion, this._scale);
      this.bolts.setMatrixAt(drawn, this._matrix);
      drawn++;
    }

    this.bolts.count = drawn;
    if (drawn > 0) this.bolts.instanceMatrix.needsUpdate = true;
  }

  _syncBombs(state) {
    const bombs = state.bombs;
    const tints = this.bombTints.array;
    const energies = this.bombEnergies.array;
    let drawn = 0;

    for (let i = 0; i < bombs.capacity; i++) {
      if (!bombs.active[i]) continue;

      const type = bombs.type[i];
      const archetype = BOMB_TYPES[type] || BOMB_TYPES[0];

      // Tumble. The rolling bomb — the one that cannot be shot down — spins
      // fastest and is the widest, so the rule is readable before it matters.
      const spinRate = archetype.homing > 0 ? 9.5 : archetype.amplitude > 0 ? 5.5 : 2.4;
      const roll = bombs.age[i] * spinRate;
      const aspect = archetype.homing > 0 ? 1.25 : 1;

      this._euler.set(0, roll * 0.7, roll);
      this._quaternion.setFromEuler(this._euler);
      this._position.set(bombs.x[i], bombs.y[i], 0);
      this._scale.set(aspect, 1, aspect);
      this._matrix.compose(this._position, this._quaternion, this._scale);
      this.bombs.setMatrixAt(drawn, this._matrix);

      const colour = this.bombColours[type] || this.bombColours[0];
      const target = drawn * 3;
      tints[target] = colour[0];
      tints[target + 1] = colour[1];
      tints[target + 2] = colour[2];

      // Ignite over the first sixth of a second so a bomb does not appear at
      // full brightness inside the formation, and dim over the last stretch to
      // the deck so a miss fades out instead of vanishing mid-air.
      const ignition = saturate(bombs.age[i] * 6);
      const altitude = saturate((bombs.y[i] - BOMB.FLOOR_Y) / 2.2);
      energies[drawn] = 0.35 + 0.65 * ignition * (0.4 + 0.6 * altitude);

      drawn++;
    }

    this.bombs.count = drawn;
    if (drawn > 0) {
      this.bombs.instanceMatrix.needsUpdate = true;
      this.bombTints.needsUpdate = true;
      this.bombEnergies.needsUpdate = true;
    }
  }
}
