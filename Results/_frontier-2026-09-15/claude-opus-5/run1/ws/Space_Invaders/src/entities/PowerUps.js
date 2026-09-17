// Pooled power-up pickups: an octahedron core inside a spinning ring, colour-coded by type.
// Dropped by killed invaders, they descend slowly and are collected by touching the cannon.
import { Group, Mesh, OctahedronGeometry, TorusGeometry } from 'three';
import { ObjectPool } from '@shared/core/ObjectPool.js';
import { neonMaterial } from '@shared/procgen/MaterialLibrary.js';
import { makeAabb, setAabb, aabbOverlap } from '@shared/math/Collision.js';
import { WORLD, POWERUPS, COLORS } from '../config.js';

const _box = makeAabb();

export class PowerUps {
  /**
   * @param {import('three').Scene} scene
   * @param {import('@shared/core/ResourceTracker.js').ResourceTracker} tracker
   * @param {import('@shared/procgen/Random.js').Random} random
   * @param {import('@shared/core/EventBus.js').EventBus} events
   */
  constructor(scene, tracker, random, events) {
    this.scene = scene;
    this.random = random;
    this.events = events;

    this.coreGeometry = tracker.track(new OctahedronGeometry(0.42, 0));
    this.ringGeometry = tracker.track(new TorusGeometry(0.62, 0.05, 10, 32));
    this.materials = {
      SPREAD: tracker.track(neonMaterial({ color: 0x1a1004, emissive: COLORS.SPREAD, intensity: 1.6 })),
      RAPID: tracker.track(neonMaterial({ color: 0x1a0414, emissive: COLORS.RAPID, intensity: 1.7 })),
      SHIELD: tracker.track(neonMaterial({ color: 0x04141a, emissive: COLORS.SHIELD, intensity: 1.5 })),
    };

    this.pool = new ObjectPool({
      capacity: POWERUPS.POOL,
      create: () => {
        const group = new Group();
        const core = new Mesh(this.coreGeometry, this.materials.SHIELD);
        const ring = new Mesh(this.ringGeometry, this.materials.SHIELD);
        group.add(core, ring);
        group.visible = false;
        scene.add(group);
        return { group, core, ring, type: 'SHIELD', x: 0, y: 0, clock: 0 };
      },
      onRelease: (item) => {
        item.group.visible = false;
      },
    });
  }

  get liveCount() {
    return this.pool.liveCount;
  }

  /** Roll a drop at an invader's death position. */
  maybeDrop(x, y) {
    if (this.pool.liveCount > 0) return false;
    if (!this.random.chance(POWERUPS.DROP_CHANCE)) return false;
    const type = this.random.weighted(POWERUPS.TYPES, POWERUPS.WEIGHTS);
    return this.spawn(x, y, type);
  }

  spawn(x, y, type) {
    const item = this.pool.acquire();
    if (!item) return false;
    item.type = type;
    item.x = x;
    item.y = y;
    item.clock = this.random.range(0, 6);
    const material = this.materials[type];
    item.core.material = material;
    item.ring.material = material;
    item.group.position.set(x, y, 0);
    item.group.visible = true;
    this.events.emit('powerup:spawn', { type, x, y });
    return true;
  }

  fixedUpdate(step) {
    this.pool.forEach((item) => {
      item.y -= POWERUPS.FALL_SPEED * step;
      if (item.y < WORLD.CULL_BOTTOM_Y) this.pool.release(item);
    });
  }

  update(dt) {
    this.pool.forEach((item) => {
      item.clock += dt;
      item.group.position.set(item.x + Math.sin(item.clock * 2.2) * 0.25, item.y, 0);
      item.core.rotation.y += dt * 2.4;
      item.core.rotation.x += dt * 1.1;
      item.ring.rotation.x = Math.PI * 0.5 + Math.sin(item.clock * 1.7) * 0.5;
      item.ring.rotation.z += dt * 1.6;
    });
  }

  /** Collect any pickup overlapping `playerBox`; emits powerup:collected per pickup. */
  collectOverlapping(playerBox) {
    let collected = 0;
    this.pool.forEach((item) => {
      setAabb(_box, item.x, item.y, POWERUPS.HALF, POWERUPS.HALF);
      if (aabbOverlap(_box, playerBox)) {
        const type = item.type;
        const x = item.x;
        const y = item.y;
        this.pool.release(item);
        collected++;
        this.events.emit('powerup:collected', { type, x, y });
      }
    });
    return collected;
  }

  clear() {
    this.pool.releaseAll();
  }

  dispose() {
    this.pool.dispose((item) => this.scene.remove(item.group));
  }
}
