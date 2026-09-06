import * as THREE from 'three';
import { ARENA, PLAYER, PALETTE, RENDER } from '../config.js';
import { SHIP_FRAMES, SHIP_SIZE } from '../content/ShipBitmap.js';
import {
  bitmapToGeometry,
  bitmapOutlineGeometry,
  centerTogether,
  mergeAndDispose
} from '@shared/procgen/GeometryLab.js';
import { makeHullPlatingTexture, releaseSource } from '@shared/procgen/TextureFactory.js';
import { normalFromHeight } from '@shared/procgen/PBRMaps.js';
import { saturate } from '@shared/util/MathUtils.js';

/**
 * The player's cannon.
 *
 * ### It is deliberately the shiniest object on screen
 *
 * The reference's composition test is "time yourself finding the player": in
 * every plate the player's craft is locatable in well under a second, and the
 * reason is material, not size or position. It is the only thing in the frame
 * at metalness 0.75 and roughness 0.20, so it is the only thing that returns a
 * hard specular highlight, and the eye goes to a specular highlight before it
 * goes to anything else.
 *
 * That is also why the cannon is the one hull whose *outline* is allowed
 * through the bloom threshold, at 1.6 against the formation's 1.05. The 55
 * invaders are lit matter; the one thing the player controls is light.
 *
 * ### Three frames, not a particle puff
 *
 * The arcade's two destruction sprites are carried in `ShipBitmap.js` and are
 * swapped in during the death freeze-out. That is what makes a death read as
 * *this ship being destroyed* rather than as a generic burst at the ship's
 * coordinates — the silhouette the player has been steering for two minutes
 * visibly comes apart before the debris takes over.
 */

/** Extrusion depth of the cannon hull. Deeper than an invader: it is closer. */
const HULL_DEPTH = 0.34;
/** Same lens-derived rim width the formation uses. */
const RIM_THICKNESS = 0.032;
const HULL_ROUNDING = 0.24;

/** How fast the destruction frames alternate during the death pause. */
const DEATH_FRAME_HZ = 11;
/** Respawn blink rate, in full cycles per second. */
const INVULN_BLINK_HZ = 6.5;

export class PlayerRenderer {
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
    this.group.position.set(0, ARENA.PLAYER_Y, 0);
    this.scene.add(this.group);
    this.disposer.trackFn(() => this.scene.remove(this.group));

    this._buildHull();
    this._buildThruster();

    /** Which of the three sprite frames is showing. */
    this.frame = 0;
  }

  /* ================================================================== *
   * Construction
   * ================================================================== */

  _buildHull() {
    // The cannon sprite is 13 x 8 and `PLAYER.WIDTH` is its target world
    // width, so the cell size is fixed by arithmetic and the mesh lands on the
    // declared dimensions without a rescale.
    const cell = PLAYER.WIDTH / SHIP_SIZE.w;

    const { texture, height, size } = makeHullPlatingTexture({
      size: 256,
      seed: 4417,
      panels: 5,
      baseColor: '#12222b',
      seamColor: '#050b0e',
      highlightColor: '#2f5b6b',
      rivetColor: '#4d8496',
      grain: 0.05
    });
    this.disposer.track(texture);
    const { texture: normalMap } = normalFromHeight(height, size, size, { strength: 2.1 });
    this.disposer.track(normalMap);

    const surface = RENDER.SURFACE.player;

    const hullMaterial = this.materials.get('siPlayerHull', () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texture,
        normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        // The one genuinely metallic, genuinely polished surface in the game.
        metalness: surface.metalness,
        roughness: surface.roughness,
        emissive: PALETTE.PLAYER,
        // Body emission stays under the glow floor. The trim carries the light.
        emissiveIntensity: 0.28
      })
    );

    const trimMaterial = this.materials.get('siPlayerTrim', () =>
      new THREE.MeshStandardMaterial({
        color: 0x061a22,
        emissive: PALETTE.PLAYER,
        // 1.6 — above `minimumGlowIntensity(0.72)` = 1.368, so unlike the
        // formation's rim this one does bloom. It is the frame's anchor.
        emissiveIntensity: surface.emissiveIntensity,
        roughness: 0.24,
        metalness: 0.3
      })
    );

    this.frames = SHIP_FRAMES.map((rows) => {
      const hull = bitmapToGeometry(rows, {
        cell,
        depth: HULL_DEPTH,
        rounded: HULL_ROUNDING,
        roundSegments: 2,
        center: false
      });
      const outline = bitmapOutlineGeometry(rows, {
        cell,
        depth: HULL_DEPTH * 1.06,
        thickness: RIM_THICKNESS,
        center: false
      });
      centerTogether([hull, outline]);
      const merged = mergeAndDispose([hull, outline], true);
      this.disposer.track(merged);
      return merged;
    });

    this.mesh = new THREE.Mesh(this.frames[0], [hullMaterial, trimMaterial]);
    this.group.add(this.mesh);

    releaseSource(texture);
    releaseSource(normalMap);
  }

  /**
   * The engine glow under the plinth.
   *
   * A small emissive bar rather than a particle emitter, for the same reason
   * the starfield is geometry: the 500-particle cap is a scarce resource that
   * has to be spent on events, and a continuously-burning thruster would hold
   * a slice of it permanently for something that never changes shape.
   *
   * It brightens with lateral speed, which is the only feedback in the game
   * that tells the player how hard they are actually moving — the cannon's
   * position is clamped and its roll is capped, so without this a full-speed
   * traverse and a nudge look the same.
   */
  _buildThruster() {
    const geometry = new THREE.BoxGeometry(PLAYER.WIDTH * 0.42, 0.07, 0.12);
    this.disposer.track(geometry);

    const material = this.materials.get('siPlayerThruster', () =>
      new THREE.MeshStandardMaterial({
        color: 0x0a2a34,
        emissive: PALETTE.BOLT,
        emissiveIntensity: 1.6,
        roughness: 0.34,
        metalness: 0
      })
    );
    this.thrusterMaterial = material;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, -0.44, 0.02);
    this.group.add(mesh);
    this.thruster = mesh;
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
    const player = state.player;

    this.group.position.x = player.x;
    // The visual bank. The hitbox never rotates — `PLAYER.HALF_WIDTH` is an
    // axis-aligned half-extent and rolling the collision box with the mesh
    // would make the ship harder to hit while it was moving, which is a
    // fairness bug disguised as a graphical flourish.
    this.group.rotation.z = player.roll;

    // --- Death frames -----------------------------------------------------
    if (!player.alive && player.deathTimer > 0) {
      const elapsed = PLAYER.DEATH_PAUSE - player.deathTimer;
      const wanted = 1 + (Math.floor(elapsed * DEATH_FRAME_HZ) % 2);
      if (wanted !== this.frame) {
        this.frame = wanted;
        this.mesh.geometry = this.frames[wanted];
      }
      this.mesh.visible = true;
      this.thruster.visible = false;
      return;
    }

    if (this.frame !== 0) {
      this.frame = 0;
      this.mesh.geometry = this.frames[0];
    }

    // --- Respawn invulnerability -----------------------------------------
    // A hard blink rather than a fade. Transparency would need a sorted
    // transparent draw for one object for a second and a half, and a hard
    // blink is also the arcade's own vocabulary for "you cannot be hit yet".
    if (player.invulnTimer > 0) {
      this.mesh.visible = Math.sin(this.time * INVULN_BLINK_HZ * Math.PI * 2) > -0.35;
    } else {
      this.mesh.visible = true;
    }

    // --- Thruster ---------------------------------------------------------
    this.thruster.visible = this.mesh.visible;
    const speed = saturate(Math.abs(player.vx) / PLAYER.MAX_SPEED);
    // Idles well under the glow floor and only crosses it under real motion,
    // so a stationary cannon does not sit there quietly blooming.
    const flicker = 0.94 + Math.sin(this.time * 41) * 0.06;
    this.thrusterMaterial.emissiveIntensity = (0.9 + speed * 1.9) * flicker;
    this.thruster.scale.set(0.8 + speed * 0.45, 1, 1);
  }

  /** World position of the muzzle, for muzzle-flash placement. */
  muzzle(out = new THREE.Vector3()) {
    return out.set(this.group.position.x, ARENA.PLAYER_Y + 0.42, 0);
  }
}
