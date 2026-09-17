// The mystery ship: lathe-profile saucer with a glass dome, rotating neon rim lights and a
// scanning beam. Crosses the top lane on a timer while at least 8 invaders remain.
import { Group, Mesh, LatheGeometry, SphereGeometry, ConeGeometry, BoxGeometry, Vector2, Vector3 } from 'three';
import { chromeMaterial, neonMaterial, glassMaterial } from '@shared/procgen/MaterialLibrary.js';
import { mergeGeometries } from '@shared/procgen/GeometryUtils.js';
import { setAabb } from '@shared/math/Collision.js';
import { WORLD, UFO, COLORS } from '../config.js';

const _pos = new Vector3();

export class UFOShip {
  /**
   * @param {import('three').Scene} scene
   * @param {import('@shared/core/ResourceTracker.js').ResourceTracker} tracker
   * @param {import('@shared/procgen/Random.js').Random} random
   * @param {import('@shared/core/EventBus.js').EventBus} events
   * @param {import('@shared/vfx/VFXDirector.js').VFXDirector} vfx
   */
  constructor(scene, tracker, random, events, vfx) {
    this.scene = scene;
    this.random = random;
    this.events = events;
    this.vfx = vfx;

    this.group = new Group();
    this.group.name = 'UFO';

    const profile = [
      new Vector2(0.0, -0.25),
      new Vector2(0.9, -0.2),
      new Vector2(1.6, 0.0),
      new Vector2(1.2, 0.25),
      new Vector2(0.6, 0.45),
      new Vector2(0.0, 0.5),
    ];
    const hullGeometry = tracker.track(new LatheGeometry(profile, 36));
    this.hullMaterial = tracker.track(chromeMaterial({ color: 0xd9dcff, roughness: 0.22, metalness: 0.95 }));
    this.hull = new Mesh(hullGeometry, this.hullMaterial);
    this.group.add(this.hull);

    const domeGeometry = tracker.track(new SphereGeometry(0.5, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5));
    this.domeMaterial = tracker.track(glassMaterial({ color: COLORS.UFO, emissive: COLORS.UFO, intensity: 1.4, opacity: 0.5 }));
    this.dome = new Mesh(domeGeometry, this.domeMaterial);
    this.dome.position.y = 0.32;
    this.group.add(this.dome);

    // Eight rim lights merged into one emissive mesh that spins.
    const lights = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const box = new BoxGeometry(0.22, 0.12, 0.22);
      box.rotateY(-a);
      box.translate(Math.cos(a) * 1.28, 0.06, Math.sin(a) * 1.28);
      lights.push(box);
    }
    const rimGeometry = tracker.track(mergeGeometries(lights));
    this.rimMaterial = tracker.track(neonMaterial({ color: 0x140408, emissive: COLORS.UFO, intensity: 2.0 }));
    this.rim = new Mesh(rimGeometry, this.rimMaterial);
    this.group.add(this.rim);

    // Scanning beam: an inverted cone hanging below the hull.
    const beamGeometry = tracker.track(new ConeGeometry(1.3, 3.2, 24, 1, true));
    this.beamMaterial = tracker.track(glassMaterial({ color: COLORS.UFO, emissive: COLORS.UFO, intensity: 0.9, opacity: 0.16 }));
    this.beam = new Mesh(beamGeometry, this.beamMaterial);
    this.beam.position.y = -1.85; // apex (+Y) sits under the hull, the base opens downward
    this.group.add(this.beam);

    this.group.visible = false;
    scene.add(this.group);
    tracker.track(this.group);

    this.active = false;
    this.x = 0;
    this.dir = 1;
    this.timer = UFO.FIRST_DELAY;
    this.clock = 0;
    this.trail = null;
  }

  reset() {
    this.active = false;
    this.group.visible = false;
    this.timer = UFO.FIRST_DELAY;
    this._dropTrail();
  }

  _dropTrail() {
    if (this.trail) {
      this.vfx.trails.release(this.trail);
      this.trail = null;
    }
  }

  spawn() {
    this.active = true;
    this.dir = this.random.sign();
    this.x = -this.dir * (WORLD.HALF_WIDTH + 3);
    this.group.visible = true;
    this.group.position.set(this.x, WORLD.UFO_Y, 0);
    this._dropTrail();
    this.trail = this.vfx.trails.acquire({ color: COLORS.UFO, width: 0.5, emissiveIntensity: 1.6, fadeTime: 0.5, minSegment: 0.15 });
    this.events.emit('ufo:spawn', { x: this.x, dir: this.dir });
  }

  aabb(out) {
    return setAabb(out, this.x, WORLD.UFO_Y, UFO.HALF_W, UFO.HALF_H);
  }

  fixedUpdate(step, aliveCount) {
    if (!this.active) {
      this.timer -= step;
      if (this.timer <= 0) {
        if (aliveCount >= UFO.MIN_ALIVE) this.spawn();
        else this.timer = 2;
      }
      return;
    }
    this.x += this.dir * UFO.SPEED * step;
    if (Math.abs(this.x) > WORLD.HALF_WIDTH + 3.5) {
      this.active = false;
      this.group.visible = false;
      this.timer = this.random.range(UFO.INTERVAL_MIN, UFO.INTERVAL_MAX);
      this._dropTrail();
      this.events.emit('ufo:escaped', {});
    }
  }

  update(dt) {
    if (!this.active) return;
    this.clock += dt;
    const bob = Math.sin(this.clock * 4) * 0.15;
    this.group.position.set(this.x, WORLD.UFO_Y + bob, 0);
    this.rim.rotation.y += dt * 3.5;
    this.beam.rotation.y += dt * 1.2;
    this.beamMaterial.opacity = 0.12 + 0.08 * Math.sin(this.clock * 9);
    this.rimMaterial.emissiveIntensity = 1.8 + 0.6 * Math.sin(this.clock * 14);
    if (this.trail) {
      _pos.set(this.x - this.dir * 1.2, WORLD.UFO_Y + bob, 0);
      this.vfx.trails.push(this.trail, _pos.x, _pos.y, _pos.z);
    }
  }

  /**
   * Destroy the ship. Preserves the cabinet's easter egg: the 23rd shot, then every 15th, is
   * worth 300; otherwise a weighted random pick.
   */
  hit(shotsFired) {
    this.active = false;
    this.group.visible = false;
    this.timer = this.random.range(UFO.INTERVAL_MIN, UFO.INTERVAL_MAX);
    this._dropTrail();
    const easter =
      shotsFired === UFO.EASTER_FIRST || (shotsFired > UFO.EASTER_FIRST && (shotsFired - UFO.EASTER_FIRST) % UFO.EASTER_EVERY === 0);
    const points = easter ? UFO.EASTER_SCORE : this.random.weighted(UFO.SCORES, UFO.WEIGHTS);
    return { points, easter, x: this.x, y: WORLD.UFO_Y };
  }

  dispose() {
    this._dropTrail();
    this.scene.remove(this.group);
  }
}
