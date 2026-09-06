import * as THREE from 'three';
import { ARENA, UFO, RENDER } from '../config.js';
import { UFO_BITMAP, SPRITE_SIZE } from '../content/InvaderBitmaps.js';
import { bitmapToGeometry } from '@shared/procgen/GeometryLab.js';
import { applyFresnelRim } from '@shared/procgen/MaterialLibrary.js';
import { makeEnergyBandTexture, releaseSource } from '@shared/procgen/TextureFactory.js';
import { saturate } from '@shared/util/MathUtils.js';

/**
 * The mystery ship, and its tractor beam.
 *
 * ### The single biggest hue violation on screen, on purpose
 *
 * The palette is a narrow 150-210 degree band — spring-green through cyan —
 * and the reference's own rule is that a frame carries two adjacent hues plus
 * one small warm accent, never a rainbow. The mystery ship is magenta at
 * emissive 2.2, which is 140 degrees outside that band and the only fully hot
 * hull in the game.
 *
 * That is what makes it an *event*. A colour that appears nowhere else, on the
 * only chrome surface in the build, crossing the top of the arena on a timer:
 * the player does not need to be told it is worth shooting. The budget that
 * makes it affordable is strict — magenta and red together stay under 8% of
 * lit pixels, the UFO under 4%, and only while it is on screen, which is a few
 * seconds every twenty-five.
 *
 * ### The beam
 *
 * A cone of scrolling energy bands under the hull, swept side to side. It is
 * the one place in this game a transparent surface is used, and it is worth
 * the sorted draw because the alternative — an opaque cone — would occlude the
 * formation behind it, and because a beam that does not show what is behind it
 * does not read as a beam.
 *
 * The scroll is `texture.offset.y`, not a custom shader: the band texture is
 * built once by the Canvas factory and moving its offset is free, where a
 * shader patch here would be a third material variant to compile for an object
 * that exists for four seconds at a time.
 */

const HULL_DEPTH = 0.28;
const HULL_ROUNDING = 0.24;

export class UfoRenderer {
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

    this.group = new THREE.Group();
    this.group.position.set(0, ARENA.UFO_Y, 0);
    this.group.visible = false;
    this.scene.add(this.group);
    this.disposer.trackFn(() => this.scene.remove(this.group));

    this._buildHull();
    this._buildBeam();
  }

  _buildHull() {
    // 16 px wide sprite, `UFO.WIDTH` target, so the cell size is arithmetic.
    const cell = UFO.WIDTH / SPRITE_SIZE.ufo.w;

    const geometry = bitmapToGeometry(UFO_BITMAP, {
      cell,
      depth: HULL_DEPTH,
      rounded: HULL_ROUNDING,
      roundSegments: 2
    });
    this.disposer.track(geometry);

    const surface = RENDER.SURFACE.ufo;
    const material = this.materials.get('siUfoHull', () => {
      const mat = new THREE.MeshStandardMaterial({
        color: UFO.COLOR,
        emissive: UFO.EMISSIVE,
        emissiveIntensity: surface.emissiveIntensity,
        // Chrome: the lowest roughness and the highest metalness in the build.
        roughness: surface.roughness,
        metalness: surface.metalness
      });
      // Unlike the invaders, this hull genuinely curves — every greedy
      // rectangle is corner-rounded and the sprite is wide and shallow, so a
      // Fresnel term resolves into a bright edge here rather than into the
      // broad wash it would produce on a flat face. The rim runs hotter than
      // the already-hot body, which is what gives the ship a chrome read
      // instead of a plastic one.
      return applyFresnelRim(mat, {
        cacheKey: 'si-ufo-rim',
        rimIntensity: surface.emissiveIntensity * 1.75,
        power: 2.6,
        bias: 0.15
      });
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.group.add(mesh);
    this.hull = mesh;
    this.hullMaterial = material;
  }

  _buildBeam() {
    const { texture } = makeEnergyBandTexture({
      size: 256,
      bands: 7,
      sharpness: 3.6,
      color: `#${new THREE.Color(UFO.EMISSIVE).getHexString()}`,
      background: '#020409'
    });
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 2.4);
    this.disposer.track(texture);
    this.beamTexture = texture;

    // Open-ended cone: no cap, because a cap would be a bright disc floating
    // in mid-air at the beam's far end.
    const geometry = new THREE.ConeGeometry(
      UFO.BEAM_RADIUS,
      UFO.BEAM_LENGTH,
      20,
      1,
      true
    );
    // The cone's apex is at +height/2 in its own space; the beam has to hang
    // from the hull, so it is flipped and lowered.
    geometry.rotateX(Math.PI);
    geometry.translate(0, -UFO.BEAM_LENGTH * 0.5 - 0.2, 0);
    this.disposer.track(geometry);

    const material = this.materials.get('siUfoBeam', () =>
      new THREE.MeshStandardMaterial({
        color: 0x120410,
        emissive: 0xffffff,
        emissiveMap: texture,
        // Under the bloom threshold. A beam that blooms fills the top third of
        // the arena with haze and hides the formation the player is shooting
        // at, which is the whole reason the selective-bloom contract exists.
        emissiveIntensity: 0.55,
        roughness: 0.6,
        metalness: 0,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      })
    );

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 4;
    this.group.add(mesh);
    this.beam = mesh;
    this.beamMaterial = material;

    releaseSource(texture);
  }

  /**
   * @param {number} dt    seconds since the last frame, unscaled
   * @param {object} state simulation state, read only
   */
  update(dt, state) {
    this.time += dt;
    const ufo = state.ufo;

    this.group.visible = ufo.active;
    if (!ufo.active) return;

    this.group.position.set(ufo.x, ufo.y, 0);

    // Bank into the direction of travel, and a slow roll about the long axis.
    // A saucer that translates without rotating reads as a sprite being slid
    // across the screen.
    this.hull.rotation.z = -ufo.direction * 0.14;
    this.hull.rotation.y = Math.sin(this.time * 0.9) * 0.22;

    // The beam sweeps across the arena beneath the ship. `beamPhase` is the
    // simulation's own sweep clock, so the visual and any gameplay effect that
    // is later hung off it cannot drift apart.
    this.beam.rotation.z = Math.sin(ufo.beamPhase) * UFO.BEAM_SWEEP;
    this.beamTexture.offset.y = (this.beamTexture.offset.y - dt * 0.85) % 1;

    // Fade the beam in over the first half-second on screen and out over the
    // last, so it never pops. `beamPhase` is monotonic, so the envelope is
    // taken from the ship's distance to the arena edge instead, which also
    // makes the beam brightest in the middle of the pass where the player is
    // most likely to be looking.
    const edge = saturate((ARENA.HALF_WIDTH - Math.abs(ufo.x)) / 3.5);
    this.beamMaterial.opacity = 0.06 + 0.26 * edge;
    this.beamMaterial.emissiveIntensity = 0.2 + 0.42 * edge;
  }
}
