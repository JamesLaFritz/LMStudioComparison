// The laser cannon: a procedural hull (plated chassis, turret, barrel) with neon engine blocks,
// banking on movement, recoil on fire, a shield bubble and invulnerability blink after respawn.
import { Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, PointLight, Vector3 } from 'three';
import { hullMaterial, neonMaterial, glassMaterial } from '@shared/procgen/MaterialLibrary.js';
import { mergeGeometries, displaceGeometry } from '@shared/procgen/GeometryUtils.js';
import { makePanelTextures } from '@shared/procgen/TextureFactory.js';
import { SimplexNoise } from '@shared/procgen/SimplexNoise.js';
import { clamp, damp, approach } from '@shared/math/MathUtils.js';
import { setAabb } from '@shared/math/Collision.js';
import { Actions } from '@shared/input/InputManager.js';
import { WORLD, PLAYER, POWERUPS, COLORS } from '../config.js';

const _dir = new Vector3();
const _pos = new Vector3();

export class Player {
  /**
   * @param {import('three').Scene} scene
   * @param {import('@shared/core/ResourceTracker.js').ResourceTracker} tracker
   * @param {import('@shared/input/InputManager.js').InputManager} input
   */
  constructor(scene, tracker, input) {
    this.scene = scene;
    this.input = input;

    this.x = 0;
    this.y = WORLD.PLAYER_Y;
    this.vx = 0;
    this.bank = 0;
    this.recoil = 0;
    this.alive = true;
    this.invulnTimer = 0;
    this.fireCooldown = 0;
    this.shield = false;
    this.power = { type: null, timer: 0 };
    this.blinkClock = 0;
    this.thrustAccum = 0;

    this.group = new Group();
    this.group.name = 'Player';

    // ── Hull: chassis + skirts + turret + barrel, merged, plated.
    const noise = new SimplexNoise(21);
    const chassis = displaceGeometry(new BoxGeometry(2.2, 0.55, 1.0, 6, 3, 4), noise, { amplitude: 0.018, frequency: 3 });
    const skirtL = new BoxGeometry(0.6, 0.3, 0.8);
    skirtL.translate(-1.2, -0.1, 0);
    const skirtR = new BoxGeometry(0.6, 0.3, 0.8);
    skirtR.translate(1.2, -0.1, 0);
    const finL = new BoxGeometry(0.12, 0.55, 0.7);
    finL.rotateZ(0.35);
    finL.translate(-1.4, 0.38, -0.05);
    const finR = new BoxGeometry(0.12, 0.55, 0.7);
    finR.rotateZ(-0.35);
    finR.translate(1.4, 0.38, -0.05);
    const turret = new CylinderGeometry(0.5, 0.66, 0.42, 16);
    turret.translate(0, 0.48, 0);
    const barrel = new CylinderGeometry(0.1, 0.13, 1.05, 12);
    barrel.translate(0, 1.15, 0);
    const hullGeometry = tracker.track(mergeGeometries([chassis, skirtL, skirtR, finL, finR, turret, barrel]));

    const panels = makePanelTextures({ size: 512, seed: 11, base: '#4a5480', seam: '#151a33', highlight: '#7d8bc0', rivet: '#b9c3ee' });
    tracker.track(panels.map);
    tracker.track(panels.roughnessMap);
    this.hullMaterial = tracker.track(
      hullMaterial({
        color: 0xd0d8f5,
        map: panels.map,
        roughnessMap: panels.roughnessMap,
        roughness: 0.4,
        metalness: 0.55,
        emissive: 0x0d3a48,
        intensity: 0.9,
      }),
    );
    this.hull = new Mesh(hullGeometry, this.hullMaterial);
    this.group.add(this.hull);

    // ── Neon: engine blocks, underglow strip, barrel tip emitter.
    const engineL = new BoxGeometry(0.36, 0.22, 0.22);
    engineL.translate(-0.6, -0.02, -0.55);
    const engineR = new BoxGeometry(0.36, 0.22, 0.22);
    engineR.translate(0.6, -0.02, -0.55);
    const strip = new BoxGeometry(2.1, 0.06, 0.08);
    strip.translate(0, -0.22, 0.52);
    const collar = new TorusGeometry(0.17, 0.04, 8, 20);
    collar.rotateX(Math.PI * 0.5);
    collar.translate(0, 0.82, 0);
    const tip = new CylinderGeometry(0.12, 0.12, 0.16, 12);
    tip.translate(0, 1.7, 0);
    const neonGeometry = tracker.track(mergeGeometries([engineL, engineR, strip, collar, tip]));
    this.neonMaterial = tracker.track(neonMaterial({ color: 0x06121a, emissive: COLORS.PLAYER, intensity: 1.6, roughness: 0.3 }));
    this.neon = new Mesh(neonGeometry, this.neonMaterial);
    this.group.add(this.neon);

    // ── Shield bubble.
    const shieldGeometry = tracker.track(new SphereGeometry(1.55, 28, 18));
    this.shieldMaterial = tracker.track(glassMaterial({ color: COLORS.SHIELD, emissive: COLORS.SHIELD, intensity: 1.2, opacity: 0.28 }));
    this.shieldMesh = new Mesh(shieldGeometry, this.shieldMaterial);
    this.shieldMesh.position.y = 0.4;
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    // ── Cannon light (created once, intensity-modulated).
    this.light = new PointLight(COLORS.PLAYER, 28, 16, 2);
    this.light.position.set(0, 0.9, 1.6);
    this.group.add(this.light);

    this.group.position.set(this.x, this.y, 0);
    scene.add(this.group);
    tracker.track(this.group);
  }

  get bulletCap() {
    if (this.power.type === 'SPREAD') return 3;
    if (this.power.type === 'RAPID') return 2;
    return 1;
  }

  get cooldownTime() {
    return this.power.type === 'RAPID' ? POWERUPS.RAPID_COOLDOWN : PLAYER.FIRE_COOLDOWN;
  }

  get invulnerable() {
    return this.invulnTimer > 0;
  }

  get muzzleY() {
    return this.y + PLAYER.MUZZLE_Y;
  }

  reset({ respawn = false, keepPower = false } = {}) {
    this.x = 0;
    this.vx = 0;
    this.bank = 0;
    this.recoil = 0;
    this.alive = true;
    this.fireCooldown = 0.2;
    this.invulnTimer = respawn ? PLAYER.INVULN_TIME : 0;
    this.blinkClock = 0;
    if (!keepPower) {
      this.power.type = null;
      this.power.timer = 0;
      this.shield = false;
    }
    this.shieldMesh.visible = this.shield;
    this.group.visible = true;
    this.group.position.set(this.x, this.y, 0);
    this.group.rotation.set(0, 0, 0);
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  aabb(out) {
    return setAabb(out, this.x, this.y + 0.3, PLAYER.HALF_W, PLAYER.HALF_H + 0.2);
  }

  /**
   * @param {number} step
   * @param {{ control:boolean, fire:boolean, projectiles:import('../systems/ProjectileSystem.js').ProjectileSystem, events:import('@shared/core/EventBus.js').EventBus }} ctx
   */
  fixedUpdate(step, ctx) {
    if (!this.alive) return;
    const input = this.input;

    // Movement: snappy acceleration toward the requested velocity.
    const target = ctx.control ? input.axis('moveX') * PLAYER.SPEED : 0;
    this.vx = approach(this.vx, target, PLAYER.ACCEL * step);
    const limit = WORLD.HALF_WIDTH - PLAYER.MARGIN;
    this.x = clamp(this.x + this.vx * step, -limit, limit);
    if ((this.x <= -limit && this.vx < 0) || (this.x >= limit && this.vx > 0)) this.vx = 0;

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - step);

    // Timed power-up.
    if (this.power.type && this.power.timer > 0) {
      this.power.timer -= step;
      if (this.power.timer <= 0) {
        const expired = this.power.type;
        this.power.type = null;
        this.power.timer = 0;
        ctx.events.emit('powerup:expired', { type: expired });
      }
    }

    // Firing. takePress() is evaluated first so a latched tap is always consumed.
    this.fireCooldown -= step;
    const tapped = input.takePress(Actions.FIRE);
    const want = tapped || input.held(Actions.FIRE);
    if (ctx.fire && ctx.control && want && this.fireCooldown <= 0) {
      const projectiles = ctx.projectiles;
      if (projectiles.playerLiveCount < this.bulletCap) {
        const my = this.muzzleY;
        let fired = 0;
        if (this.power.type === 'SPREAD') {
          const a = POWERUPS.SPREAD_ANGLE;
          if (projectiles.spawnPlayer(this.x, my, -a)) fired++;
          if (projectiles.spawnPlayer(this.x, my, 0)) fired++;
          if (projectiles.spawnPlayer(this.x, my, a)) fired++;
        } else if (projectiles.spawnPlayer(this.x, my, 0)) {
          fired++;
        }
        if (fired > 0) {
          this.fireCooldown = this.cooldownTime;
          this.recoil = 1;
          ctx.events.emit('player:fired', { x: this.x, y: my, count: fired });
        }
      }
    }
  }

  /**
   * Visual update. `vfx` is used for the thruster stream.
   * @param {number} dt
   * @param {import('@shared/vfx/VFXDirector.js').VFXDirector} vfx
   */
  update(dt, vfx) {
    const g = this.group;
    g.position.x = this.x;
    g.position.y = this.y;

    this.bank = damp(this.bank, (-this.vx / PLAYER.SPEED) * PLAYER.BANK_ANGLE, 12, dt);
    g.rotation.z = this.bank;

    this.recoil = Math.max(0, this.recoil - dt * 7);
    const kick = this.recoil * this.recoil;
    this.hull.position.y = -0.12 * kick;
    this.neon.position.y = -0.12 * kick;
    this.neonMaterial.emissiveIntensity = 1.6 + 1.6 * kick;
    this.light.intensity = 28 + 60 * kick;

    if (this.alive && this.invulnTimer > 0) {
      this.blinkClock += dt;
      const phase = Math.floor(this.blinkClock * PLAYER.BLINK_HZ * 2) % 2;
      this.hull.visible = phase === 0;
      this.neon.visible = phase === 0;
    } else {
      this.hull.visible = true;
      this.neon.visible = true;
    }

    this.shieldMesh.visible = this.shield && this.alive;
    if (this.shieldMesh.visible) {
      this.shieldMesh.rotation.y += dt * 0.8;
      this.shieldMaterial.opacity = 0.22 + 0.1 * Math.sin(performance.now() * 0.006);
    }

    // Thruster stream while moving.
    if (this.alive && Math.abs(this.vx) > 2 && vfx) {
      this.thrustAccum += dt * 70;
      const n = Math.floor(this.thrustAccum);
      if (n > 0) {
        this.thrustAccum -= n;
        const s = Math.sign(this.vx);
        _pos.set(this.x - s * 1.15, this.y - 0.1, 0);
        _dir.set(-s, 0, 0);
        vfx.particles.stream(_pos, _dir, COLORS.PLAYER, n);
      }
    }
  }

  /** Register a hit. Returns 'shield' when absorbed, 'dead' when the cannon is destroyed. */
  hit() {
    if (this.shield) {
      this.shield = false;
      this.shieldMesh.visible = false;
      return 'shield';
    }
    this.alive = false;
    this.group.visible = false;
    this.power.type = null;
    this.power.timer = 0;
    return 'dead';
  }

  applyPowerUp(type) {
    if (type === 'SHIELD') {
      this.shield = true;
      this.shieldMesh.visible = true;
      return;
    }
    this.power.type = type;
    this.power.timer = POWERUPS.DURATION;
  }

  dispose() {
    this.scene.remove(this.group);
    this.light.dispose();
  }
}
