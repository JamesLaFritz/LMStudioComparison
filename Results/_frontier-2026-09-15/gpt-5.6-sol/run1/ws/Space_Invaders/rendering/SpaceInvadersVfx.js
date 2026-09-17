import * as THREE from 'three';
import { mulberry32, lerp } from '../../shared/math/MathUtils.js';
import { CameraShake } from '../../shared/vfx/CameraShake.js';
import { ParticleManager } from '../../shared/vfx/ParticleManager.js';
import { MotionTrailPool } from '../../shared/vfx/MotionTrailPool.js';
import { ShockwavePool } from '../../shared/vfx/ShockwavePool.js';
import { FloatingTextManager } from '../../shared/vfx/FloatingTextManager.js';
import {
  CONFIG,
  EVENT_TYPES,
  PALETTE,
  VFX_PRIORITY,
} from '../config.js';
import {
  createParticleGeometry,
  createShockwaveGeometry,
  createTrailGeometry,
} from './GeometryFactory.js';

const makeVfxMaterial = (color, emissiveIntensity = 2.4) => new THREE.MeshStandardMaterial({
  color,
  emissive: 0x101820,
  emissiveIntensity: emissiveIntensity * 0.24,
  metalness: 0.18,
  roughness: 0.28,
  vertexColors: true,
});

export class SpaceInvadersVfx {
  constructor({ scene, camera, textRoot, seed = 1, onBloomPulse = () => {}, onArenaPulse = () => {} }) {
    this.scene = scene;
    this.camera = camera;
    this.onBloomPulse = onBloomPulse;
    this.onArenaPulse = onArenaPulse;
    this.random = mulberry32((seed ^ 0x91e10da5) >>> 0);
    this.cameraShake = new CameraShake(seed);
    this.particles = new ParticleManager(
      scene,
      createParticleGeometry(),
      makeVfxMaterial(0xffffff, 1.75),
      { capacity: CONFIG.pools.particles, random: this.random },
    );
    this.trails = new MotionTrailPool(
      scene,
      createTrailGeometry(),
      makeVfxMaterial(0xffffff, 2.1),
      CONFIG.pools.trails,
    );
    this.shockwaves = new ShockwavePool(
      scene,
      createShockwaveGeometry(),
      makeVfxMaterial(0xffffff, 2.8),
      CONFIG.pools.shockwaves,
    );
    this.floatingText = new FloatingTextManager(textRoot, CONFIG.pools.floatingText);
    this.playerTrailActive = new Uint8Array(CONFIG.player.projectilePool);
    this.playerTrailX = new Float32Array(CONFIG.player.projectilePool);
    this.playerTrailY = new Float32Array(CONFIG.player.projectilePool);
    this.enemyTrailActive = new Uint8Array(CONFIG.enemy.projectilePool);
    this.enemyTrailX = new Float32Array(CONFIG.enemy.projectilePool);
    this.enemyTrailY = new Float32Array(CONFIG.enemy.projectilePool);
    this._createImpactLights();
  }

  _createImpactLights() {
    this.impactLights = [];
    for (let i = 0; i < 3; i += 1) {
      const light = new THREE.PointLight(PALETTE.cyan, 0, 6.5, 2);
      light.position.z = 2;
      light.visible = false;
      this.scene.add(light);
      this.impactLights.push({ light, age: 0, lifetime: 0, peak: 0 });
    }
  }

  _flashLight(x, y, color, peak = 16, lifetime = 0.18) {
    let slot = this.impactLights.find((item) => !item.light.visible);
    if (!slot) slot = this.impactLights.reduce((oldest, item) => (item.age > oldest.age ? item : oldest));
    slot.light.color.setHex(color);
    slot.light.position.set(x, y, 2);
    slot.light.intensity = peak;
    slot.light.visible = true;
    slot.age = 0;
    slot.lifetime = lifetime;
    slot.peak = peak;
  }

  setAccessibility(profile) {
    this.cameraShake.setReducedMotion(profile.reducedMotion);
    this.floatingText.setReducedMotion(profile.reducedMotion);
  }

  handleEvent(event, hitStop) {
    switch (event.type) {
      case EVENT_TYPES.PLAYER_SHOT:
        this.particles.burst(event.x, event.y, 4, PALETTE.cyan, VFX_PRIORITY.MINOR, 0.8, 2.2, 0.2, 0.8, -Math.PI * 0.5, -1, 2.2);
        break;
      case EVENT_TYPES.ENEMY_SHOT:
        this.particles.burst(event.x, event.y, 3, this._enemyColor(event.variant), VFX_PRIORITY.AMBIENT, 0.5, 1.8, 0.18, 0.7, Math.PI * 0.5, -0.5, 2);
        break;
      case EVENT_TYPES.INVADER_KILLED: {
        const color = event.variant === 0 ? PALETTE.magenta : event.variant === 1 ? PALETTE.amber : PALETTE.green;
        const critical = event.priority === VFX_PRIORITY.CRITICAL;
        this.particles.burst(event.x, event.y, critical ? 52 : 24, color, event.priority, 2, critical ? 9 : 6.5, critical ? 0.75 : 0.52, Math.PI * 2, 0, -4.5, 2.8);
        this.shockwaves.spawn(event.x, event.y, 0.12, critical ? 2.5 : 1.15, critical ? 0.55 : 0.32, color, event.priority);
        this.floatingText.spawn(event.x, event.y, event.text, event.priority, event.variant === 0 ? 'magenta' : 'amber');
        this.cameraShake.addImpact(event.speed, critical ? 0.35 : 0.08, critical ? 0.42 : 0.18);
        hitStop.request(critical ? 0.1 : 0.038, critical ? 0 : 0.12, event.priority);
        this._flashLight(event.x, event.y, color, critical ? 26 : 12, critical ? 0.3 : 0.16);
        this.onArenaPulse(critical ? 1 : 0.45);
        if (critical) this.onBloomPulse(0.18);
        break;
      }
      case EVENT_TYPES.UFO_KILLED:
        this.particles.burst(event.x, event.y, 68, PALETTE.magenta, VFX_PRIORITY.HEAVY, 2.5, 10, 0.85, Math.PI * 2, 0, -3.2, 3.2);
        this.shockwaves.spawn(event.x, event.y, 0.2, 3.1, 0.62, PALETTE.magenta, VFX_PRIORITY.HEAVY);
        this.floatingText.spawn(event.x, event.y, event.text, VFX_PRIORITY.HEAVY, 'magenta', 1.25);
        this.cameraShake.addImpact(event.speed, 0.26, 0.34);
        hitStop.request(0.085, 0.02, VFX_PRIORITY.HEAVY);
        this._flashLight(event.x, event.y, PALETTE.magenta, 30, 0.35);
        this.onBloomPulse(0.18);
        this.onArenaPulse(1);
        break;
      case EVENT_TYPES.PROJECTILE_CLASH:
        this.particles.burst(event.x, event.y, 12, PALETTE.white, VFX_PRIORITY.MINOR, 1.5, 5, 0.3, Math.PI * 2, 0, -2, 2.4);
        this.shockwaves.spawn(event.x, event.y, 0.06, 0.65, 0.2, PALETTE.cyan, VFX_PRIORITY.MINOR);
        this.cameraShake.addTrauma(0.04);
        hitStop.request(0.02, 0.25, VFX_PRIORITY.MINOR);
        break;
      case EVENT_TYPES.BUNKER_HIT:
        this.particles.burst(event.x, event.y, Math.min(18, 5 + event.value * 2), PALETTE.cyan, VFX_PRIORITY.MINOR, 0.8, 4, 0.42, 2.2, event.ny > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, -5, 1.8);
        this.cameraShake.addTrauma(Math.min(0.08, event.value * 0.009));
        break;
      case EVENT_TYPES.PLAYER_HIT:
        this.particles.burst(event.x, event.y, 90, PALETTE.cyan, VFX_PRIORITY.CRITICAL, 2.5, 11, 0.95, Math.PI * 2, 0, -3.8, 3.4);
        this.shockwaves.spawn(event.x, event.y, 0.2, 3.8, 0.72, PALETTE.cyan, VFX_PRIORITY.CRITICAL);
        this.cameraShake.addImpact(event.speed, 0.55, 0.45);
        hitStop.request(0.12, 0, VFX_PRIORITY.CRITICAL);
        this._flashLight(event.x, event.y, PALETTE.cyan, 34, 0.4);
        this.onBloomPulse(0.18);
        this.onArenaPulse(1);
        break;
      case EVENT_TYPES.EXTRA_LIFE:
        this.floatingText.spawn(0, -1, event.text, VFX_PRIORITY.HEAVY, 'cyan', 1.4);
        this.shockwaves.spawn(0, CONFIG.player.y, 0.2, 2.2, 0.7, PALETTE.cyan, VFX_PRIORITY.HEAVY);
        break;
      case EVENT_TYPES.WAVE_CLEAR:
        this.shockwaves.spawn(0, 0, 0.5, 9, 1, PALETTE.amber, event.priority);
        this.cameraShake.addTrauma(event.priority === VFX_PRIORITY.CRITICAL ? 0.55 : 0.28);
        this.onBloomPulse(0.18);
        this.onArenaPulse(1);
        break;
      case EVENT_TYPES.VICTORY:
        this.particles.burst(0, 1, 110, PALETTE.amber, VFX_PRIORITY.CRITICAL, 3, 12, 1.4, Math.PI * 2, 0, -2.5, 3.2);
        this.shockwaves.spawn(0, 1, 0.4, 11, 1.3, PALETTE.amber, VFX_PRIORITY.CRITICAL);
        this.cameraShake.addTrauma(0.72);
        this.onBloomPulse(0.18);
        break;
      case EVENT_TYPES.GAME_OVER:
        this.shockwaves.spawn(0, CONFIG.player.y, 0.4, 6, 0.9, PALETTE.red, VFX_PRIORITY.CRITICAL);
        this.cameraShake.addTrauma(0.6);
        break;
      default:
        break;
    }
  }

  _enemyColor(variant) {
    return variant === 0 ? PALETTE.red : variant === 1 ? PALETTE.amber : PALETTE.magenta;
  }

  depositTrails(simulation) {
    const player = simulation.playerProjectiles;
    for (let id = 0; id < player.capacity; id += 1) {
      if (!player.pool.isActive(id)) {
        this.playerTrailActive[id] = 0;
        continue;
      }
      if (this.playerTrailActive[id] === 0) {
        this.playerTrailActive[id] = 1;
        this.playerTrailX[id] = player.x[id];
        this.playerTrailY[id] = player.y[id];
        continue;
      }
      const dx = player.x[id] - this.playerTrailX[id];
      const dy = player.y[id] - this.playerTrailY[id];
      if (dx * dx + dy * dy < 0.22 * 0.22) continue;
      this.trails.deposit(player.x[id], player.y[id] - 0.22, 0, 0.45, 0.08, PALETTE.cyan, 1, 0.2);
      this.playerTrailX[id] = player.x[id];
      this.playerTrailY[id] = player.y[id];
    }

    const enemy = simulation.enemyProjectiles;
    for (let id = 0; id < enemy.capacity; id += 1) {
      if (!enemy.pool.isActive(id)) {
        this.enemyTrailActive[id] = 0;
        continue;
      }
      if (this.enemyTrailActive[id] === 0) {
        this.enemyTrailActive[id] = 1;
        this.enemyTrailX[id] = enemy.x[id];
        this.enemyTrailY[id] = enemy.y[id];
        continue;
      }
      const dx = enemy.x[id] - this.enemyTrailX[id];
      const dy = enemy.y[id] - this.enemyTrailY[id];
      if (dx * dx + dy * dy < 0.22 * 0.22) continue;
      const angle = Math.atan2(dy, dx) - Math.PI * 0.5;
      this.trails.deposit(enemy.x[id], enemy.y[id] + 0.18, angle, 0.4, 0.07, this._enemyColor(enemy.kind[id]), 1, 0.24);
      this.enemyTrailX[id] = enemy.x[id];
      this.enemyTrailY[id] = enemy.y[id];
    }
  }

  update(realDt, gameDt) {
    const vfxDt = lerp(realDt, gameDt, 0.7);
    this.particles.update(vfxDt);
    this.trails.update(vfxDt);
    this.shockwaves.update(vfxDt);
    this.floatingText.update(this.camera, realDt);
    for (const slot of this.impactLights) {
      if (!slot.light.visible) continue;
      slot.age += realDt;
      if (slot.age >= slot.lifetime) {
        slot.light.visible = false;
        slot.light.intensity = 0;
      } else {
        const t = slot.age / slot.lifetime;
        slot.light.intensity = slot.peak * (1 - t) ** 2;
      }
    }
    return this.cameraShake.update(realDt);
  }

  reset() {
    this.particles.reset();
    this.trails.reset();
    this.shockwaves.reset();
    this.floatingText.reset();
    this.cameraShake.reset();
    this.playerTrailActive.fill(0);
    this.enemyTrailActive.fill(0);
    for (const slot of this.impactLights) {
      slot.light.visible = false;
      slot.light.intensity = 0;
    }
  }

  dispose() {
    this.particles.dispose();
    this.trails.dispose();
    this.shockwaves.dispose();
    this.floatingText.dispose();
    for (const slot of this.impactLights) {
      this.scene.remove(slot.light);
      if (typeof slot.light.dispose === 'function') slot.light.dispose();
    }
    this.impactLights.length = 0;
  }
}
