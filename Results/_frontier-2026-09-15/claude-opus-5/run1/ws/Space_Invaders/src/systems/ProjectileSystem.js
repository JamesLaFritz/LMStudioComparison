// Pooled projectiles. Player bolts are capsules with ribbon trails; invader shots come in three
// classic flavours (plunger, rolling, squiggly). Every bullet keeps its previous position so
// collision can sweep a segment rather than test a point.
import { Mesh, CapsuleGeometry, CylinderGeometry, BoxGeometry } from 'three';
import { ObjectPool } from '@shared/core/ObjectPool.js';
import { neonMaterial } from '@shared/procgen/MaterialLibrary.js';
import { mergeGeometries } from '@shared/procgen/GeometryUtils.js';
import { setAabb } from '@shared/math/Collision.js';
import { WORLD, PLAYER, BULLETS, INVADER_FIRE, COLORS } from '../config.js';

function makeRollingGeometry() {
  const a = new BoxGeometry(0.3, 0.08, 0.08);
  const b = new BoxGeometry(0.08, 0.3, 0.08);
  b.translate(0, 0, 0);
  const c = new BoxGeometry(0.07, 0.8, 0.07);
  const d = new BoxGeometry(0.3, 0.08, 0.08);
  d.translate(0, -0.3, 0);
  d.rotateY(Math.PI * 0.5);
  a.translate(0, 0.3, 0);
  return mergeGeometries([a, b, c, d]);
}

function makeSquigglyGeometry() {
  const parts = [];
  const segments = 9;
  for (let k = 0; k < segments; k++) {
    const t = k / (segments - 1);
    const y = -0.4 + t * 0.8;
    const x = Math.sin(t * Math.PI * 2) * 0.13;
    const box = new BoxGeometry(0.1, 0.12, 0.1);
    box.translate(x, y, 0);
    parts.push(box);
  }
  return mergeGeometries(parts);
}

export class ProjectileSystem {
  /**
   * @param {import('three').Scene} scene
   * @param {import('@shared/core/ResourceTracker.js').ResourceTracker} tracker
   * @param {import('@shared/vfx/VFXDirector.js').VFXDirector} vfx
   */
  constructor(scene, tracker, vfx) {
    this.scene = scene;
    this.vfx = vfx;

    this.playerGeometry = tracker.track(new CapsuleGeometry(0.08, 0.55, 4, 8));
    this.playerMaterial = tracker.track(neonMaterial({ color: 0x06141a, emissive: COLORS.BULLET_PLAYER, intensity: 2.0 }));

    this.invaderGeometries = {
      plunger: tracker.track(new CylinderGeometry(0.1, 0.15, 0.8, 8)),
      rolling: tracker.track(makeRollingGeometry()),
      squiggly: tracker.track(makeSquigglyGeometry()),
    };
    this.invaderMaterial = tracker.track(neonMaterial({ color: 0x1a1004, emissive: COLORS.BULLET_INVADER, intensity: 1.6 }));

    this.playerPool = new ObjectPool({
      capacity: BULLETS.PLAYER_POOL,
      create: () => {
        const mesh = new Mesh(this.playerGeometry, this.playerMaterial);
        mesh.visible = false;
        scene.add(mesh);
        return {
          mesh,
          x: 0,
          y: 0,
          prevX: 0,
          prevY: 0,
          vx: 0,
          vy: 0,
          age: 0,
          trail: null,
          halfW: PLAYER.BULLET_HALF_W,
          halfH: PLAYER.BULLET_HALF_H,
          owner: 'player',
        };
      },
      onRelease: (b) => {
        b.mesh.visible = false;
        if (b.trail) {
          this.vfx.trails.release(b.trail);
          b.trail = null;
        }
      },
    });

    this.invaderPool = new ObjectPool({
      capacity: BULLETS.INVADER_POOL,
      create: () => {
        const mesh = new Mesh(this.invaderGeometries.plunger, this.invaderMaterial);
        mesh.visible = false;
        scene.add(mesh);
        return {
          mesh,
          x: 0,
          y: 0,
          x0: 0,
          prevX: 0,
          prevY: 0,
          vy: 0,
          age: 0,
          kind: 'plunger',
          halfW: BULLETS.INVADER_HALF_W,
          halfH: BULLETS.INVADER_HALF_H,
          owner: 'invader',
        };
      },
      onRelease: (b) => {
        b.mesh.visible = false;
      },
    });
  }

  get playerLiveCount() {
    return this.playerPool.liveCount;
  }

  get invaderLiveCount() {
    return this.invaderPool.liveCount;
  }

  /** Fire a player bolt at `angle` radians from straight up. Returns the bullet or null. */
  spawnPlayer(x, y, angle = 0) {
    const b = this.playerPool.acquire();
    if (!b) return null;
    b.x = x;
    b.y = y;
    b.prevX = x;
    b.prevY = y;
    b.vx = Math.sin(angle) * PLAYER.BULLET_SPEED;
    b.vy = Math.cos(angle) * PLAYER.BULLET_SPEED;
    b.age = 0;
    b.mesh.position.set(x, y, 0);
    b.mesh.rotation.set(0, 0, -angle);
    b.mesh.visible = true;
    b.trail = this.vfx.trails.acquire({ color: COLORS.BULLET_PLAYER, width: 0.16, emissiveIntensity: 2.2, fadeTime: 0.2 });
    if (b.trail) this.vfx.trails.push(b.trail, x, y - 0.3, 0);
    return b;
  }

  spawnInvader(x, y, kind, speed) {
    const b = this.invaderPool.acquire();
    if (!b) return null;
    b.x = x;
    b.x0 = x;
    b.y = y;
    b.prevX = x;
    b.prevY = y;
    b.vy = -speed;
    b.age = 0;
    b.kind = kind;
    b.mesh.geometry = this.invaderGeometries[kind] || this.invaderGeometries.plunger;
    b.mesh.position.set(x, y, 0);
    b.mesh.rotation.set(0, 0, 0);
    b.mesh.scale.set(1, 1, 1);
    b.mesh.visible = true;
    return b;
  }

  releasePlayer(b) {
    this.playerPool.release(b);
  }

  releaseInvader(b) {
    this.invaderPool.release(b);
  }

  fixedUpdate(step) {
    this.playerPool.forEach((b) => {
      b.prevX = b.x;
      b.prevY = b.y;
      b.x += b.vx * step;
      b.y += b.vy * step;
      b.age += step;
      b.mesh.position.set(b.x, b.y, 0);
      if (b.y > WORLD.CULL_TOP_Y || Math.abs(b.x) > WORLD.HALF_WIDTH + 2) this.playerPool.release(b);
    });

    this.invaderPool.forEach((b) => {
      b.prevX = b.x;
      b.prevY = b.y;
      b.age += step;
      b.y += b.vy * step;
      if (b.kind === 'squiggly') {
        b.x = b.x0 + INVADER_FIRE.ZIGZAG_AMP * Math.sin(Math.PI * 2 * INVADER_FIRE.ZIGZAG_HZ * b.age);
      }
      b.mesh.position.set(b.x, b.y, 0);
      if (b.kind === 'rolling') b.mesh.rotation.y += 14 * step;
      else if (b.kind === 'plunger') b.mesh.scale.y = 1 + 0.25 * Math.sin(b.age * 30);
      if (b.y < WORLD.CULL_BOTTOM_Y) this.invaderPool.release(b);
    });
  }

  /** Per-frame: feed trails with the latest bolt positions. */
  update() {
    this.playerPool.forEach((b) => {
      if (b.trail) this.vfx.trails.push(b.trail, b.x, b.y - 0.3, 0);
    });
  }

  bulletAabb(b, out) {
    return setAabb(out, b.x, b.y, b.halfW, b.halfH);
  }

  clearInvaderBullets() {
    this.invaderPool.releaseAll();
  }

  clearAll() {
    this.playerPool.releaseAll();
    this.invaderPool.releaseAll();
  }

  dispose() {
    this.playerPool.dispose((b) => this.scene.remove(b.mesh));
    this.invaderPool.dispose((b) => this.scene.remove(b.mesh));
  }
}
