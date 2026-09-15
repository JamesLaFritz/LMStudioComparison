import * as THREE from 'three';
import { ObjectPool } from '../shared/core/ObjectPool.js';
import { MotionTrail } from '../shared/core/MotionTrail.js';

/**
 * One pooled bullet: a PBR emissive bar + a motion trail.
 * Movement is plain kinematics; swept collision is resolved by Game.
 */
class Bullet {
  constructor(scene, geometry, material, trailColor, halfX, halfY) {
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.trail = new MotionTrail({ segments: 10, width: 0.16, color: trailColor });
    this.trail.attach(this.mesh);
    this.trail.setEnabled(false);
    scene.add(this.trail.mesh);

    this.active = false;
    this.vx = 0;
    this.vy = 0;
    this.halfX = halfX;
    this.halfY = halfY;
  }

  fire(x, y, vx, vy) {
    this.active = true;
    this.vx = vx;
    this.vy = vy;
    this.mesh.position.set(x, y, 0);
    this.mesh.visible = true;
    this.trail.clear();
    this.trail.setEnabled(true);
  }

  update(dt) {
    if (!this.active) return;
    this.mesh.position.x += this.vx * dt;
    this.mesh.position.y += this.vy * dt;
  }

  /** Visual reset only — returning to the pool is the pool's job (reset hook). */
  deactivate() {
    this.active = false;
    this.vx = 0;
    this.vy = 0;
    this.mesh.visible = false;
    this.trail.setEnabled(false);
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.trail.dispose();
  }
}

/**
 * Pooled player + enemy bullets. Zero allocation in the hot path.
 * Player: 8 slots (classic one-bullet rule + wide shot).
 * Enemy: 24 slots (max simultaneous = 6 + wave).
 */
class Bullets {
  constructor(scene) {
    this.scene = scene;

    this.playerGeo = new THREE.BoxGeometry(0.22, 0.9, 0.22);
    this.playerMat = new THREE.MeshStandardMaterial({
      color: 0x0a2a33,
      emissive: 0x00e5ff,
      emissiveIntensity: 3.2,
      metalness: 0.4,
      roughness: 0.3,
    });

    this.enemyGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    this.enemyMat = new THREE.MeshStandardMaterial({
      color: 0x2a0a26,
      emissive: 0xff2fd6,
      emissiveIntensity: 3.0,
      metalness: 0.4,
      roughness: 0.3,
    });

    this.player = new ObjectPool(
      () => {
        const b = new Bullet(scene, this.playerGeo, this.playerMat, 0x00e5ff, 0.11, 0.45);
        return b;
      },
      (b) => b.deactivate(),
      8
    );

    this.enemy = new ObjectPool(
      () => {
        const b = new Bullet(scene, this.enemyGeo, this.enemyMat, 0xff2fd6, 0.1, 0.35);
        return b;
      },
      (b) => b.deactivate(),
      24
    );
  }

  /** Fire one (or two, wide) player bullets. Returns the first bullet or null. */
  firePlayer(x, y, wide = false) {
    const b = this.player.acquire();
    if (!b) return null;
    b.fire(x, y, 0, 28);
    if (wide) {
      const b2 = this.player.acquire();
      if (b2) b2.fire(x + 0.55, y, 0, 28);
    }
    return b;
  }

  /** Fire one enemy bullet straight down. Returns the bullet or null (pool full). */
  fireEnemy(x, y, speed) {
    const b = this.enemy.acquire();
    if (!b) return null;
    b.fire(x, y, 0, -speed);
    return b;
  }

  update(dt) {
    this.player.forEachActive((b) => b.update(dt));
    this.enemy.forEachActive((b) => b.update(dt));
  }

  forEachPlayer(fn) {
    this.player.forEachActive(fn);
  }

  forEachEnemy(fn) {
    this.enemy.forEachActive(fn);
  }

  /** Return a specific bullet to its pool (visual reset + free-list). */
  releasePlayer(b) { this.player.release(b); }
  releaseEnemy(b) { this.enemy.release(b); }

  /** BOMB power-up: clear every enemy bullet. */
  clearEnemy() {
    this.enemy.releaseAll();
  }

  clearAll() {
    this.player.releaseAll();
    this.enemy.releaseAll();
  }

  dispose() {
    const scene = this.scene;
    this.player.forEachActive((b) => b.dispose(scene));
    this.enemy.forEachActive((b) => b.dispose(scene));
    this.playerGeo.dispose();
    this.playerMat.dispose();
    this.enemyGeo.dispose();
    this.enemyMat.dispose();
  }
}

export { Bullets };
