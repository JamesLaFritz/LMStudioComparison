import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { randRange } from '../../shared/utils/MathUtils.js';
import { UFO } from '../config/GameConfig.js';
import { PROJECTILE_OWNER } from './Projectile.js';

function buildSaucerGeometry() {
  const hull = new THREE.SphereGeometry(0.5, 16, 10);
  hull.scale(1, 0.35, 1);

  const rim = new THREE.TorusGeometry(0.55, 0.08, 8, 24);
  rim.rotateX(Math.PI / 2);

  const merged = mergeGeometries([hull, rim], false);
  hull.dispose();
  rim.dispose();
  merged.computeVertexNormals();
  return merged;
}

const BOSS_PHASE_DURATION = 3;
const BOSS_FIRE_INTERVAL = 0.5;

/**
 * Dual-purpose: the classic "Signal Drone" mystery UFO on normal waves
 * (flies across, awards the shot-parity bonus), and a 3-phase Flagship
 * boss on every 5th wave (spread / sweep / volley attack patterns).
 */
export class UFOBoss {
  constructor(scene, projectileSystem, { disposer = null } = {}) {
    this._scene = scene;
    this._projectiles = projectileSystem;

    this._geometry = buildSaucerGeometry();
    disposer?.trackGeometry(this._geometry);

    this._material = new THREE.MeshStandardMaterial({
      color: 0x151022,
      emissive: 0x9b5bff,
      emissiveIntensity: 1.4,
      roughness: 0.3,
      metalness: 0.7
    });
    disposer?.trackMaterial(this._material);

    this.mesh = new THREE.Mesh(this._geometry, this._material);
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.active = false;
    this.isBoss = false;
    this.direction = 1;
    this.spawnTimer = randRange(UFO.spawnMinInterval, UFO.spawnMaxInterval);
    this.shotsFiredSinceLast = 0;
    this.health = 1;
    this.maxHealth = 1;

    this._phaseTimer = 0;
    this._phaseIndex = 0;
    this._fireTimer = 0;
  }

  registerPlayerShot() {
    this.shotsFiredSinceLast += 1;
  }

  trySpawn(playfieldMinX, playfieldMaxX, isBossWave) {
    if (this.active || this.spawnTimer > 0) return false;

    this.active = true;
    this.isBoss = isBossWave;
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.mesh.position.set(
      this.direction === 1 ? playfieldMinX - 2 : playfieldMaxX + 2,
      UFO.y,
      UFO.z
    );
    this.mesh.visible = true;
    this.mesh.scale.setScalar(this.isBoss ? 2.2 : 1);
    this.health = this.isBoss ? 5 : 1;
    this.maxHealth = this.health;
    this._phaseTimer = 0;
    this._phaseIndex = 0;
    this._fireTimer = 0.6;
    return true;
  }

  takeDamage(amount = 1) {
    this.health -= amount;
    return this.health <= 0;
  }

  consumeBonusScore() {
    const table = UFO.shotParityTable;
    return table[this.shotsFiredSinceLast % table.length];
  }

  update(dt, playfieldMinX, playfieldMaxX, onExit) {
    if (!this.active) {
      this.spawnTimer -= dt;
      return;
    }

    this.mesh.position.x += this.direction * UFO.speed * dt;
    this.mesh.rotation.y += dt * 2;

    if (this.isBoss) {
      this._updateBossFire(dt);
    }

    if (this.mesh.position.x > playfieldMaxX + 2 || this.mesh.position.x < playfieldMinX - 2) {
      this._despawn();
      onExit?.();
    }
  }

  _updateBossFire(dt) {
    this._phaseTimer += dt;
    this._fireTimer -= dt;

    if (this._phaseTimer > BOSS_PHASE_DURATION) {
      this._phaseTimer = 0;
      this._phaseIndex = (this._phaseIndex + 1) % 3;
    }

    if (this._fireTimer <= 0) {
      this._fireTimer = BOSS_FIRE_INTERVAL;
      this._fireBossPattern();
    }
  }

  _fireBossPattern() {
    const origin = this.mesh.position;

    if (this._phaseIndex === 0) {
      for (let i = -2; i <= 2; i++) {
        const angle = (i * 12 * Math.PI) / 180;
        this._projectiles.spawn({
          x: origin.x,
          y: origin.y,
          z: origin.z,
          vx: Math.sin(angle) * 4,
          vy: 0,
          vz: Math.cos(angle) * 9,
          owner: PROJECTILE_OWNER.BOSS,
          radius: 0.16,
          color: 0x9b5bff,
          rotationX: Math.PI / 2
        });
      }
    } else if (this._phaseIndex === 1) {
      this._projectiles.spawn({
        x: origin.x,
        y: origin.y,
        z: origin.z,
        vx: 0,
        vy: 0,
        vz: 14,
        owner: PROJECTILE_OWNER.BOSS,
        radius: 0.1,
        color: 0xff3fd6,
        rotationX: Math.PI / 2
      });
    } else {
      for (let i = -1; i <= 1; i++) {
        this._projectiles.spawn({
          x: origin.x,
          y: origin.y,
          z: origin.z,
          vx: i * 2,
          vy: 0,
          vz: 10,
          owner: PROJECTILE_OWNER.BOSS,
          radius: 0.14,
          color: 0xffb02e,
          rotationX: Math.PI / 2
        });
      }
    }
  }

  _despawn() {
    this.active = false;
    this.mesh.visible = false;
    this.spawnTimer = randRange(UFO.spawnMinInterval, UFO.spawnMaxInterval);
    this.shotsFiredSinceLast = 0;
  }

  destroy() {
    const wasBoss = this.isBoss;
    this._despawn();
    return wasBoss;
  }

  dispose() {
    this._scene.remove(this.mesh);
  }
}
