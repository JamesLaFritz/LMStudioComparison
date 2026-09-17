import { GAME_EVENT } from '../config.js';

const COLOR = Object.freeze({
  cyan: 0x35e8ff,
  cyanHot: 0xa9f8ff,
  magenta: 0xff3fcb,
  amber: 0xffb84d,
  danger: 0xff405f,
  success: 0x75ffb7,
  violet: 0x9d7bff,
});

const toLogical = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number / 256 : 0;
};

const toWorldX = (value) => (toLogical(value) - 112) * 0.1;
const toWorldY = (value) => (toLogical(value) - 128) * 0.1;
const normal = (value) => Math.max(-1, Math.min(1, (Number(value) || 0) / 256));

const trailColor = (projectile) => {
  if (projectile.owner === 'player') return COLOR.cyanHot;
  if (projectile.role === 'plunger') return COLOR.magenta;
  if (projectile.role === 'squiggly') return COLOR.violet;
  return COLOR.danger;
};

/** Maps simulation events to generic scene, VFX, audio, and UI presentation. */
export class SpaceInvadersPresentation {
  constructor({ scene, vfx, audio, ui } = {}) {
    if (!scene || !vfx || !audio || !ui) {
      throw new TypeError('SpaceInvadersPresentation requires scene, vfx, audio, and ui');
    }
    this.scene = scene;
    this.vfx = vfx;
    this.audio = audio;
    this.ui = ui;
    this.disposed = false;
    this.trailRecords = [
      { generation: 0, x: NaN, y: NaN },
      { generation: 0, x: NaN, y: NaN },
      { generation: 0, x: NaN, y: NaN },
      { generation: 0, x: NaN, y: NaN },
    ];
    this._trailVisitor = this._trailVisitor.bind(this);
    this._sceneTrailVisitor = this._sceneTrailVisitor.bind(this);
    this._activeTrailRecord = null;
    this.sceneTrailScratch = {};
  }

  consumeEvent(event, state) {
    if (this.disposed || !event) return;
    this.audio.consumeEvent(event, state);

    const x = toWorldX(event.x);
    const y = toWorldY(event.y);
    const nx = normal(event.nx);
    const ny = normal(event.ny);
    const traumaSpeed = Math.max(0, Number(event.speed) || 0);
    const speed = Math.max(0.5, Math.min(14, (traumaSpeed || 80) * 0.006));
    const priority = Math.max(0, Math.min(4, Number(event.priority) || 0));
    const magnitude = Math.max(1, Number(event.magnitude) || 1);

    switch (event.type) {
      case GAME_EVENT.MUZZLE_FLASH:
        this.vfx.emitBurst({ kind: 'spark', count: 8, priority: 1, x, y, z: 0.5, normalX: 0, normalY: 1, speed: 2.8, spread: 0.5, life: 0.2, scale: 0.12, color: COLOR.cyanHot, accelerationY: -1.8, drag: 2.4 });
        this.vfx.emitImpactLight({ x, y, z: 1.4, color: COLOR.cyan, intensity: 2.2, distance: 3.2, life: 0.09, priority: 1 });
        break;
      case GAME_EVENT.ENEMY_MUZZLE:
        this.vfx.emitBurst({ kind: 'mote', count: 5, priority: 0, x, y, z: 0.4, normalX: 0, normalY: -1, speed: 1.7, spread: 0.7, life: 0.18, scale: 0.1, color: COLOR.danger, accelerationY: 1.2, drag: 2 });
        break;
      case GAME_EVENT.FORMATION_MARCH:
        this.vfx.addTrauma({ speed: traumaSpeed || 120, magnitude: 0.025 + Math.min(0.055, magnitude * 0.006), priority: 0, normalX: nx, normalY: ny });
        break;
      case GAME_EVENT.PROJECTILE_INTERCEPT:
        this._impact({ x, y, nx, ny, speed, traumaSpeed, priority: Math.max(2, priority), color: COLOR.cyanHot, count: 22, magnitude: 0.19 });
        this.vfx.emitShockwave({ x, y, z: 0.32, priority: 2, r0: 0.08, rMax: 1.2, life: 0.23, color: COLOR.cyan });
        break;
      case GAME_EVENT.SHIELD_HIT:
        this.vfx.emitBurst({ kind: 'fragment', count: Math.min(30, 8 + magnitude * 2), priority: 1, x, y, z: 0.25, normalX: nx, normalY: ny || 1, speed: Math.max(1.5, speed), spread: 1.4, life: 0.42, scale: 0.12, color: COLOR.success, accelerationY: -4, drag: 1.8 });
        this.vfx.emitImpactLight({ x, y, z: 1, color: COLOR.success, intensity: 1.8, distance: 2.7, life: 0.11, priority: 1 });
        break;
      case GAME_EVENT.ALIEN_KILLED:
        this._impact({ x, y, nx, ny, speed, traumaSpeed, priority: Math.max(3, priority), color: COLOR.magenta, count: 34, magnitude: 0.3 });
        this.vfx.emitBurst({ kind: 'fragment', count: 12, priority: 3, x, y, z: 0.6, normalX: nx, normalY: ny || -1, speed: 3.7, spread: 2.2, life: 0.74, scale: 0.18, color: COLOR.violet, accelerationY: -5.2, drag: 1.25 });
        this._emitScore(event, x, y, 'alien');
        break;
      case GAME_EVENT.SAUCER_SPAWNED:
        this.vfx.emitShockwave({ x, y, z: 0.35, priority: 1, r0: 0.2, rMax: 2.4, life: 0.46, color: COLOR.magenta });
        this.ui.showTransient('Unidentified warp signature', 'critical');
        break;
      case GAME_EVENT.SAUCER_EXITED:
        this.vfx.emitShockwave({ x, y, z: 0.3, priority: 1, r0: 0.16, rMax: 1.8, life: 0.35, color: COLOR.magenta });
        break;
      case GAME_EVENT.SAUCER_KILLED:
        this._impact({ x, y, nx, ny, speed, traumaSpeed, priority: 4, color: COLOR.amber, count: 62, magnitude: 0.72 });
        this.vfx.emitBurst({ kind: 'fragment', count: 28, priority: 4, x, y, z: 0.6, normalX: nx, normalY: ny || -1, speed: 6.2, spread: 2.8, life: 1.05, scale: 0.23, color: COLOR.magenta, accelerationY: -5, drag: 0.9 });
        this.vfx.emitShockwave({ x, y, z: 0.4, priority: 4, r0: 0.18, rMax: 4.5, life: 0.66, color: COLOR.amber });
        this._emitScore(event, x, y, 'saucer');
        this.ui.showTransient(`Saucer neutralized  +${Math.max(0, Number(event.value) || 0)}`, 'success');
        break;
      case GAME_EVENT.PLAYER_KILLED:
        this._impact({ x, y, nx, ny, speed, traumaSpeed, priority: 4, color: COLOR.danger, count: 82, magnitude: 0.94 });
        this.vfx.emitBurst({ kind: 'fragment', count: 32, priority: 4, x, y, z: 0.7, normalX: nx, normalY: ny || 1, speed: 6.5, spread: 3.1, life: 1.1, scale: 0.25, color: COLOR.cyan, accelerationY: -6, drag: 0.75 });
        this.vfx.emitShockwave({ x, y, z: 0.4, priority: 4, r0: 0.16, rMax: 5.2, life: 0.7, color: COLOR.danger });
        this.ui.showTransient('Defender destroyed', 'critical');
        break;
      case GAME_EVENT.BONUS_LIFE:
        this.vfx.emitShockwave({ x: 0, y: -10.8, z: 0.35, priority: 3, r0: 0.2, rMax: 5, life: 0.78, color: COLOR.success });
        this.vfx.emitScore({ x: 0, y: -9.8, z: 0.5, value: 1, text: 'RESERVE CRAFT +1', tone: 'success', priority: 3 });
        this.ui.showTransient('Reserve craft awarded', 'success');
        break;
      case GAME_EVENT.WAVE_CLEAR:
        this.vfx.emitShockwave({ x: 0, y: 0, z: 0.2, priority: 4, r0: 0.8, rMax: 17, life: 1.3, color: COLOR.cyan });
        this.vfx.emitBurst({ kind: 'mote', count: 110, priority: 2, x: 0, y: 0, z: 0.2, normalX: 0, normalY: 1, speed: 8, spread: 6.28, life: 1.45, scale: 0.16, color: COLOR.cyan, accelerationY: -1.1, drag: 0.55 });
        this.vfx.addTrauma({ speed: 260, magnitude: 0.36, priority: 4, normalY: 1 });
        this.ui.showTransient('Formation neutralized', 'success');
        break;
      case GAME_EVENT.VICTORY:
        this.vfx.emitShockwave({ x: 0, y: 0, z: 0.2, priority: 4, r0: 0.7, rMax: 8.5, life: 1.05, color: COLOR.amber });
        this.vfx.emitBurst({ kind: 'mote', count: 120, priority: 3, x: 0, y: 0, z: 0.3, normalX: 0, normalY: 1, speed: 8, spread: 6.28, life: 1.65, scale: 0.17, color: COLOR.success, accelerationY: -0.8, drag: 0.48 });
        this.ui.showTransient('All sectors secured', 'success');
        break;
      case GAME_EVENT.INVASION:
        this.vfx.emitShockwave({ x: 0, y: -10, z: 0.2, priority: 4, r0: 0.25, rMax: 6.25, life: 0.68, color: COLOR.danger });
        this.vfx.addTrauma({ speed: traumaSpeed || 420, magnitude: 1, priority: 4, normalX: nx, normalY: ny || -1 });
        this.ui.showTransient('Invasion perimeter crossed', 'critical');
        break;
      case GAME_EVENT.GAME_OVER:
        this.vfx.addTrauma({ speed: 180, magnitude: 0.45, priority: 4, normalY: -1 });
        break;
      default:
        break;
    }
  }

  _impact({ x, y, nx, ny, speed, traumaSpeed, priority, color, count, magnitude }) {
    this.vfx.emitBurst({ kind: 'spark', count, priority, x, y, z: 0.52, normalX: nx, normalY: ny || 1, speed, spread: 2, life: 0.5, scale: 0.15, color, accelerationY: -4.5, drag: 1.35 });
    this.vfx.emitImpactLight({ x, y, z: 1.6, color, intensity: 5 + magnitude * 8, distance: 4 + magnitude * 3, life: 0.16 + magnitude * 0.16, priority });
    this.vfx.addTrauma({ speed: traumaSpeed || 180, magnitude, priority, normalX: nx, normalY: ny });
  }

  _emitScore(event, x, y, tone) {
    const value = Math.max(0, Number(event.value) || 0);
    if (value <= 0) return;
    this.vfx.emitScore({ x, y, z: 0.8, value, text: `+${value}`, tone, priority: Math.max(2, Number(event.priority) || 0) });
  }

  syncContinuous(state, realDelta) {
    if (this.disposed) return;
    this.audio.sync(state);
    if (typeof this.scene.getTrailSamples === 'function') {
      this.scene.getTrailSamples(this._sceneTrailVisitor, this.sceneTrailScratch);
    } else {
      this._sampleProjectileTrails(state?.pools);
    }
    this.vfx.advance(realDelta);
  }

  _sceneTrailVisitor(spec) {
    const index = Math.max(0, Math.min(this.trailRecords.length - 1, Math.trunc(spec.ownerId) || 0));
    const record = this.trailRecords[index];
    if (record.x === spec.x && record.y === spec.y) return;
    record.x = spec.x;
    record.y = spec.y;
    this.vfx.sampleTrail(spec);
  }

  _sampleProjectileTrails(pools) {
    if (!pools) return;
    const shotPools = [pools.playerShots, pools.rollingShots, pools.plungerShots, pools.squigglyShots];
    for (let index = 0; index < shotPools.length; index += 1) {
      const pool = shotPools[index];
      if (!pool?.forEachActive) continue;
      this._activeTrailRecord = this.trailRecords[index];
      pool.forEachActive(this._trailVisitor);
    }
    this._activeTrailRecord = null;
  }

  _trailVisitor(projectile) {
    const record = this._activeTrailRecord;
    if (!record || (record.generation === projectile.generation && record.x === projectile.x && record.y === projectile.y)) return;
    record.generation = projectile.generation;
    record.x = projectile.x;
    record.y = projectile.y;
    if (projectile.x === projectile.prevX && projectile.y === projectile.prevY) return;
    this.vfx.sampleTrail({
      x: toWorldX(projectile.x),
      y: toWorldY(projectile.y),
      z: 0.35,
      prevX: toWorldX(projectile.prevX),
      prevY: toWorldY(projectile.prevY),
      prevZ: 0.35,
      color: trailColor(projectile),
      width: projectile.owner === 'player' ? 0.09 : 0.13,
      life: projectile.owner === 'player' ? 0.19 : 0.27,
      active: true,
    });
  }

  reset() {
    if (this.disposed) return;
    for (let index = 0; index < this.trailRecords.length; index += 1) {
      const record = this.trailRecords[index];
      record.generation = 0;
      record.x = NaN;
      record.y = NaN;
    }
    this.audio.reset();
    this.vfx.reset();
  }

  dispose() {
    this.disposed = true;
    this._activeTrailRecord = null;
    this.sceneTrailScratch = null;
    this.scene = null;
    this.vfx = null;
    this.audio = null;
    this.ui = null;
  }
}
