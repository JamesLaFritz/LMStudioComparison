// Space Invaders — game orchestrator. Owns the state machine, the entities and systems, wires
// collision events to score / VFX / audio, and drives the wave and life flow through to VICTORY
// or GAME_OVER.
import { Vector3 } from 'three';
import { GameBase } from '@shared/core/GameBase.js';
import { StateMachine } from '@shared/core/StateMachine.js';
import { ResourceTracker } from '@shared/core/ResourceTracker.js';
import { Actions } from '@shared/input/InputManager.js';
import { Random } from '@shared/procgen/Random.js';
import { clamp, damp, degToRad } from '@shared/math/MathUtils.js';
import { WORLD, GAME, SCORING, VFX, COLORS, POWERUPS, RENDER } from './config.js';
import { Player } from './entities/Player.js';
import { InvaderFormation } from './entities/InvaderFormation.js';
import { Bunkers } from './entities/Bunkers.js';
import { UFOShip } from './entities/UFO.js';
import { PowerUps } from './entities/PowerUps.js';
import { ProjectileSystem } from './systems/ProjectileSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { ScoreSystem } from './systems/ScoreSystem.js';
import { WaveDirector } from './systems/WaveDirector.js';
import { Environment } from './world/Environment.js';
import { HUD } from './ui/HUD.js';
import { SoundBank } from './audio/SoundBank.js';

const _hitPos = new Vector3();
const _fxPos = new Vector3();
const _camPos = new Vector3();
const _camTarget = new Vector3();

const POWER_LABEL = { SPREAD: 'SPREAD SHOT', RAPID: 'RAPID FIRE', SHIELD: 'SHIELD' };
const MULT_CSS = ['', COLORS.CSS.CYAN, COLORS.CSS.CYAN, COLORS.CSS.MAGENTA, COLORS.CSS.AMBER];
const FIREWORK_PALETTE = [COLORS.CYAN, COLORS.MAGENTA, COLORS.LIME, COLORS.AMBER, COLORS.VIOLET];

export const States = Object.freeze({
  TITLE: 'TITLE',
  WAVE_INTRO: 'WAVE_INTRO',
  PLAY: 'PLAY',
  PAUSED: 'PAUSED',
  PLAYER_DEATH: 'PLAYER_DEATH',
  WAVE_CLEAR: 'WAVE_CLEAR',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY',
});

export class SpaceInvadersGame extends GameBase {
  constructor({ seed = undefined } = {}) {
    super();
    this.seed = seed;
    this.state = new StateMachine(this);
    this.endless = false;
    this.pressure = 0;
    this.gameOverReason = null;
    this.landed = false;
    this.menuShown = false;
    this.fireworkClock = 0;
    this.startHiScore = 0;
    this._lastIntensity = -1;
    this._subs = [];
  }

  init(engine) {
    super.init(engine);
    const scene = engine.scene;
    this.events = engine.events;
    this.vfx = engine.vfx;
    this.random = new Random(this.seed === undefined ? undefined : this.seed >>> 0);
    this.tracker = new ResourceTracker();

    this.environment = new Environment(scene, this.tracker, this.random);
    this.player = new Player(scene, this.tracker, engine.input);
    this.formation = new InvaderFormation(scene, this.tracker, this.random, this.events);
    this.bunkers = new Bunkers(scene, this.tracker, this.random);
    this.projectiles = new ProjectileSystem(scene, this.tracker, this.vfx);
    this.ufo = new UFOShip(scene, this.tracker, this.random, this.events, this.vfx);
    this.powerups = new PowerUps(scene, this.tracker, this.random, this.events);
    this.collision = new CollisionSystem({
      events: this.events,
      formation: this.formation,
      projectiles: this.projectiles,
      bunkers: this.bunkers,
      ufo: this.ufo,
      powerups: this.powerups,
      player: this.player,
    });
    this.score = new ScoreSystem(this.events);
    this.waves = new WaveDirector();
    this.hud = new HUD(engine.container, engine.input, this.events);
    this.sound = new SoundBank(engine.audio, this.events);

    this._wireEvents();
    this._buildStates();
    this.state.onChange = (from, to) => this.events.emit('state:changed', { from, to });
    this.state.set(States.TITLE);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event wiring: collision outcomes → game consequences.

  _wireEvents() {
    const ev = this.events;
    const vfx = this.vfx;
    this._subs = [
      ev.on('hit:invader', ({ index }) => this._onInvaderHit(index)),
      ev.on('hit:ufo', () => this._onUfoHit()),
      ev.on('hit:bunker', ({ index, x, y, byPlayer }) => this._onBunkerHit(index, x, y, byPlayer)),
      ev.on('hit:cancel', ({ x, y }) => {
        _fxPos.set(x, y, 0);
        vfx.particles.sparks(_fxPos, COLORS.AMBER, VFX.CANCEL.particles, { priority: 0 });
        vfx.rings.spawn({ position: _fxPos, color: COLORS.AMBER, startRadius: 0.1, endRadius: 0.8, duration: 0.25, intensity: 2 });
        vfx.shake.addTrauma(VFX.CANCEL.trauma);
        ev.emit('bullet:cancelled', { x, y });
      }),
      ev.on('hit:bunkerEaten', ({ erased, x, y }) => {
        _fxPos.set(x, y, 0);
        vfx.particles.debris(_fxPos, COLORS.BUNKER, Math.min(12, erased * 2));
      }),
      ev.on('hit:player', ({ x, y, source }) => this._onPlayerHit(x, y, source)),
      ev.on('invader:fire', ({ x, y, kind, speed }) => {
        if (this.projectiles.spawnInvader(x, y, kind, speed)) ev.emit('invader:fired', { x, y, kind });
      }),
      ev.on('invader:invaded', () => {
        if (this.state.is(States.PLAY)) this._gameOver('invaded');
      }),
      ev.on('invader:drop', () => {
        vfx.shake.addTrauma(VFX.DROP.trauma);
        if (this.pressure > 0.6) this.engine.input.rumble(80, 0.2, 0.4);
      }),
      ev.on('player:fired', ({ x, y, count }) => {
        this.score.recordShot(count);
        _fxPos.set(x, y, 0);
        vfx.particles.sparks(_fxPos, COLORS.PLAYER, VFX.FIRE.particles, { priority: 0, speed: [2, 5], life: [0.1, 0.2] });
        vfx.shake.addTrauma(VFX.FIRE.trauma);
        this.environment.flashMuzzle(x, y);
      }),
      ev.on('powerup:collected', ({ type, x, y }) => {
        this.player.applyPowerUp(type);
        _fxPos.set(x, y, 0);
        vfx.impact({
          position: _fxPos,
          color: COLORS[type],
          strength: VFX.POWERUP.strength,
          particles: VFX.POWERUP.particles,
          ringEnd: VFX.POWERUP.ringEnd,
          shake: VFX.POWERUP.trauma,
          hitStop: VFX.POWERUP.hitStop,
          text: POWER_LABEL[type],
          textSize: 'md',
        });
      }),
      ev.on('life:extra', ({ position }) => {
        const p = position || _fxPos.set(this.player.x, this.player.y + 1.5, 0);
        vfx.particles.explosion(p, COLORS.LIME, VFX.EXTRA_LIFE.particles, { priority: 1 });
        vfx.shake.addTrauma(VFX.EXTRA_LIFE.trauma);
        vfx.text.spawn({ position: p, text: '1UP', color: COLORS.CSS.LIME, size: 'lg', duration: 1.4, rise: 2.5 });
      }),
      ev.on('engine:visibility', ({ hidden }) => {
        if (hidden && this.state.is(States.PLAY)) this.state.set(States.PAUSED);
      }),
    ];
  }

  _onInvaderHit(index) {
    const info = this.formation.kill(index);
    if (!info) return;
    _hitPos.set(info.x, info.y, 0);
    const { award, multiplier } = this.score.addKill(info.points, _hitPos);
    const text = multiplier > 1 ? `+${award} ×${multiplier}` : `+${award}`;
    this.vfx.impact({
      position: _hitPos,
      color: info.color,
      strength: VFX.KILL.strength,
      particles: VFX.KILL.particles,
      ringEnd: VFX.KILL.ringEnd,
      shake: VFX.KILL.trauma,
      hitStop: VFX.KILL.hitStop,
      text,
      textColor: MULT_CSS[Math.min(4, multiplier)],
      textSize: multiplier >= 3 ? 'lg' : 'md',
    });
    this.powerups.maybeDrop(info.x, info.y);
    this.events.emit('invader:killed', { ...info, award, multiplier });
    if (this.formation.aliveCount === 0 && this.state.is(States.PLAY)) this.state.set(States.WAVE_CLEAR);
  }

  _onUfoHit() {
    if (!this.ufo.active) return;
    const r = this.ufo.hit(this.score.stats.shots);
    this.score.stats.ufoKills++;
    this.score.stats.hits++;
    _hitPos.set(r.x, r.y, 0);
    this.score.addScore(r.points, _hitPos);
    this.vfx.impact({
      position: _hitPos,
      color: COLORS.UFO,
      strength: VFX.UFO.strength,
      particles: VFX.UFO.particles,
      ringEnd: VFX.UFO.ringEnd,
      shake: VFX.UFO.trauma,
      hitStop: VFX.UFO.hitStop,
      text: r.easter ? `+${r.points} ★` : `+${r.points}`,
      textSize: 'lg',
    });
    this.engine.input.rumble(150, 0.4, 0.6);
    this.events.emit('ufo:killed', { points: r.points, x: r.x, y: r.y, easter: r.easter });
  }

  _onBunkerHit(index, x, y, byPlayer) {
    const r = this.bunkers.damage(index, 1);
    _fxPos.set(x, y, 0);
    this.vfx.particles.debris(_fxPos, r.destroyed > 0 ? COLORS.BUNKER : COLORS.BUNKER_SCORCH, VFX.BUNKER.particles + r.destroyed * 2);
    this.vfx.shake.addTrauma(VFX.BUNKER.trauma);
    this.events.emit('bunker:hit', { index, x, y, byPlayer, destroyed: r.destroyed });
  }

  _onPlayerHit(x, y, source) {
    if (!this.state.is(States.PLAY) || !this.player.alive) return;
    const result = this.player.hit();
    if (result === 'shield') {
      _fxPos.set(this.player.x, this.player.y + 0.4, 0);
      this.vfx.impact({
        position: _fxPos,
        color: COLORS.SHIELD,
        strength: VFX.SHIELD.strength,
        particles: VFX.SHIELD.particles,
        ringEnd: VFX.SHIELD.ringEnd,
        shake: VFX.SHIELD.trauma,
        hitStop: VFX.SHIELD.hitStop,
        text: 'SHIELD',
      });
      this.engine.input.rumble(120, 0.3, 0.5);
      this.events.emit('player:shielded', { x, y, source });
      return;
    }
    this.state.set(States.PLAYER_DEATH, { x, y, source });
  }

  _gameOver(reason) {
    if (!this.state.is(States.GAME_OVER)) this.state.set(States.GAME_OVER, reason);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State machine.

  _buildStates() {
    const S = States;
    const sm = this.state;

    sm.add(S.TITLE, {
      enter: () => {
        this.hud.hideMenu();
        this.hud.setHudVisible(false);
        this.endless = false;
        this.score.flush();
        this.vfx.reset();
        this.projectiles.clearAll();
        this.powerups.clear();
        this.ufo.reset();
        this.bunkers.rebuild();
        this.formation.setParams(this.waves.start(1));
        this.formation.reset(1, { demo: true, flyIn: false });
        this.formation.frozen = false;
        this.player.reset();
        this.player.alive = false;
        this.player.setVisible(false);
        this.pressure = 0;
        this.environment.setPressure(0);
        this.engine.composer.setVignetteTint(COLORS.RED, 0, RENDER.retro.vignetteColor);
        this.engine.rig.offset.set(0, 0, 0);
        this.hud.showTitle({ onStart: () => this._newGame(), hiScore: this.score.hiScore });
        this.hud.setHint(this.engine.audio.unlocked ? '' : 'Press any key or click to enable audio');
        this.sound.setMusic(true, 0.3);
      },
      exit: () => {
        this.hud.hideMenu();
        this.hud.setHint('');
      },
      update: (dt) => {
        this.hud.updateMenu(dt);
        if (this.engine.audio.unlocked) this.hud.setHint('');
        this.formation.update(dt);
        this.environment.update(dt);
        this.sound.update();
      },
      fixedUpdate: (step) => {
        this.formation.fixedUpdate(step, null);
      },
    });

    sm.add(S.WAVE_INTRO, {
      enter: ({ wave }) => {
        const params = this.waves.start(wave);
        this.formation.setParams(params);
        this.formation.reset(wave, { demo: false, flyIn: true });
        this.bunkers.rebuild();
        this.projectiles.clearAll();
        this.powerups.clear();
        this.ufo.reset();
        this.player.reset({ respawn: false, keepPower: false });
        this.player.setVisible(true);
        this.landed = false;
        const finalWave = !this.endless && wave === GAME.WAVES_TO_WIN;
        this.hud.banner(`WAVE ${wave}`, finalWave ? 'Final assault' : this.endless ? 'Endless' : 'Incoming', {
          color: finalWave ? COLORS.CSS.MAGENTA : COLORS.CSS.CYAN,
        });
        this.sound.setMusic(true, 0.35);
        this._lastIntensity = -1;
        this.events.emit('wave:intro', { wave, endless: this.endless });
      },
      update: (dt) => {
        this._updateWorld(dt);
        if (!this.landed && this.formation.flyInDone) {
          this.landed = true;
          _fxPos.set(0, this.formation.lowestY() - 1, 0);
          this.vfx.rings.spawn({ position: _fxPos, color: COLORS.MAGENTA, startRadius: 2, endRadius: 16, duration: 0.7, intensity: 2 });
          this.vfx.shake.addTrauma(0.15);
        }
        if (this.landed && sm.time >= GAME.WAVE_INTRO_TIME) sm.set(S.PLAY);
      },
      fixedUpdate: (step) => {
        this.player.fixedUpdate(step, { control: true, fire: false, projectiles: this.projectiles, events: this.events });
      },
    });

    sm.add(S.PLAY, {
      enter: () => {
        this.formation.frozen = false;
        this.engine.input.flush();
        this.hud.setHudVisible(true);
        if (sm.previous === S.WAVE_INTRO) this.events.emit('wave:start', { wave: this.waves.wave });
        if (sm.previous === S.PLAYER_DEATH) this.formation.grace();
      },
      update: (dt) => {
        if (this.engine.input.takePress(Actions.PAUSE)) {
          sm.set(S.PAUSED);
          return;
        }
        this._updateWorld(dt);
      },
      fixedUpdate: (step) => {
        this.player.fixedUpdate(step, { control: true, fire: true, projectiles: this.projectiles, events: this.events });
        this.formation.fixedUpdate(step, {
          playerX: this.player.x,
          liveShots: this.projectiles.invaderLiveCount,
          canShoot: this.player.alive,
        });
        if (!sm.is(S.PLAY)) return;
        this.ufo.fixedUpdate(step, this.formation.aliveCount);
        this.projectiles.fixedUpdate(step);
        this.powerups.fixedUpdate(step);
        this.collision.fixedUpdate();
        if (!sm.is(S.PLAY)) return;
        this.score.update(step);
      },
    });

    sm.add(S.PAUSED, {
      enter: () => {
        this.hud.showPause({
          onResume: () => sm.set(S.PLAY),
          onRestart: () => this._newGame(),
          onQuit: () => sm.set(S.TITLE),
        });
        this.sound.setIntensity(0.1);
        this._lastIntensity = -1;
      },
      exit: () => {
        this.hud.hideMenu();
        this.engine.input.flush();
      },
      update: (dt) => {
        this.hud.updateMenu(dt);
        this.environment.update(dt);
      },
    });

    sm.add(S.PLAYER_DEATH, {
      enter: ({ x, y, source }) => {
        _fxPos.set(this.player.x, this.player.y + 0.4, 0);
        this.vfx.impact({
          position: _fxPos,
          color: COLORS.PLAYER,
          strength: VFX.DEATH.strength,
          particles: VFX.DEATH.particles,
          ringEnd: VFX.DEATH.ringEnd,
          shake: VFX.DEATH.trauma,
          hitStop: VFX.DEATH.hitStop,
        });
        this.vfx.particles.explosion(_fxPos, COLORS.AMBER, 40, { priority: 3 });
        this.engine.composer.flash(COLORS.WHITE, 0.55);
        this.engine.input.rumble(400, 0.8, 1.0);
        this.projectiles.clearInvaderBullets();
        this.formation.frozen = true;
        this.score.loseLife();
        this.events.emit('player:died', { x, y, source, lives: this.score.lives });
      },
      update: (dt) => {
        this._updateWorld(dt);
        if (sm.time >= GAME.DEATH_TIME) {
          if (this.score.lives > 0) {
            this.player.reset({ respawn: true });
            this.events.emit('player:respawn', { lives: this.score.lives });
            sm.set(S.PLAY);
          } else {
            this._gameOver('lives');
          }
        }
      },
      fixedUpdate: (step) => {
        this.projectiles.fixedUpdate(step);
        this.powerups.fixedUpdate(step);
      },
    });

    sm.add(S.WAVE_CLEAR, {
      enter: () => {
        this.formation.frozen = true;
        this.projectiles.clearInvaderBullets();
        const bonus = SCORING.WAVE_BONUS_PER_WAVE * this.waves.wave + SCORING.WAVE_BONUS_PER_CELL * this.bunkers.liveCells;
        this.score.stats.wavesCleared++;
        this.score.addScore(bonus, null);
        _fxPos.set(0, WORLD.VIEW.centerY, 0);
        this.vfx.impact({
          position: _fxPos,
          color: COLORS.LIME,
          strength: VFX.WAVE_CLEAR.strength,
          particles: VFX.WAVE_CLEAR.particles,
          ringEnd: VFX.WAVE_CLEAR.ringEnd,
          shake: VFX.WAVE_CLEAR.trauma,
          hitStop: VFX.WAVE_CLEAR.hitStop,
        });
        this.hud.banner('WAVE CLEARED', `Bonus +${bonus}`, { color: COLORS.CSS.LIME });
        this.events.emit('wave:clear', { wave: this.waves.wave, bonus });
      },
      update: (dt) => {
        this._updateWorld(dt);
        if (sm.time >= GAME.WAVE_CLEAR_TIME) {
          if (!this.endless && this.waves.wave >= GAME.WAVES_TO_WIN) sm.set(S.VICTORY);
          else sm.set(S.WAVE_INTRO, { wave: this.waves.wave + 1 });
        }
      },
      fixedUpdate: (step) => {
        this.player.fixedUpdate(step, { control: true, fire: false, projectiles: this.projectiles, events: this.events });
        this.ufo.fixedUpdate(step, 0);
        this.projectiles.fixedUpdate(step);
        this.powerups.fixedUpdate(step);
        this.collision.pickups();
      },
    });

    sm.add(S.GAME_OVER, {
      enter: (reason) => {
        this.gameOverReason = reason;
        this.formation.frozen = true;
        this.menuShown = false;
        if (this.player.alive) {
          this.player.hit();
          _fxPos.set(this.player.x, this.player.y + 0.4, 0);
          this.vfx.impact({
            position: _fxPos,
            color: COLORS.PLAYER,
            strength: VFX.DEATH.strength,
            particles: VFX.DEATH.particles,
            ringEnd: VFX.DEATH.ringEnd,
            shake: VFX.DEATH.trauma,
            hitStop: VFX.DEATH.hitStop,
          });
          this.engine.composer.flash(COLORS.RED, 0.45);
        }
        this.projectiles.clearInvaderBullets();
        this.engine.composer.setVignetteTint(COLORS.RED, 0.45, RENDER.retro.vignetteColor);
        this.score.flush();
        this.engine.input.flush();
        this.events.emit('game:over', { reason, score: this.score.score });
      },
      exit: () => {
        this.hud.hideMenu();
      },
      update: (dt) => {
        this._updateWorld(dt, { pressure: false });
        if (!this.menuShown && sm.time >= GAME.GAME_OVER_DELAY) {
          this.menuShown = true;
          this.hud.showGameOver({
            reason: this.gameOverReason,
            stats: { ...this.score.stats, accuracy: this.score.accuracy },
            score: this.score.score,
            hiScore: this.score.hiScore,
            isNewHi: this.score.score > this.startHiScore && this.score.score > 0,
            onRetry: () => this._newGame(),
            onTitle: () => sm.set(S.TITLE),
          });
        }
        if (this.menuShown) this.hud.updateMenu(dt);
      },
      fixedUpdate: (step) => {
        this.projectiles.fixedUpdate(step);
        this.powerups.fixedUpdate(step);
      },
    });

    sm.add(S.VICTORY, {
      enter: () => {
        this.formation.frozen = true;
        this.menuShown = false;
        this.fireworkClock = 0;
        this.projectiles.clearAll();
        this.powerups.clear();
        this.ufo.reset();
        this.score.flush();
        this.engine.input.flush();
        this.engine.composer.setVignetteTint(COLORS.RED, 0, RENDER.retro.vignetteColor);
        this.hud.banner('SECTOR CLEARED', 'All waves repelled', { color: COLORS.CSS.LIME, duration: 2.4 });
        this.events.emit('game:victory', { score: this.score.score, waves: this.waves.wave });
      },
      exit: () => {
        this.hud.hideMenu();
      },
      update: (dt) => {
        this._updateWorld(dt, { pressure: false });
        this.fireworkClock -= dt;
        if (this.fireworkClock <= 0) {
          this.fireworkClock = this.random.range(0.25, 0.5);
          const color = this.random.pick(FIREWORK_PALETTE);
          _fxPos.set(this.random.range(-12, 12), this.random.range(8, 21), this.random.range(-2, 1));
          this.vfx.particles.explosion(_fxPos, color, 40, { priority: 1, gravity: -2, speed: [3, 9] });
          this.vfx.rings.spawn({ position: _fxPos, color, startRadius: 0.4, endRadius: 3.5, duration: 0.6, intensity: 2.2 });
          this.vfx.shake.addTrauma(0.05);
        }
        if (!this.menuShown && sm.time >= GAME.VICTORY_DELAY) {
          this.menuShown = true;
          this.hud.showVictory({
            stats: { ...this.score.stats, accuracy: this.score.accuracy },
            score: this.score.score,
            hiScore: this.score.hiScore,
            isNewHi: this.score.score > this.startHiScore && this.score.score > 0,
            onEndless: () => {
              this.endless = true;
              sm.set(S.WAVE_INTRO, { wave: this.waves.wave + 1 });
            },
            onTitle: () => sm.set(S.TITLE),
          });
        }
        if (this.menuShown) this.hud.updateMenu(dt);
      },
      fixedUpdate: (step) => {
        this.player.fixedUpdate(step, { control: true, fire: false, projectiles: this.projectiles, events: this.events });
      },
    });
  }

  _newGame() {
    this.score.reset();
    this.waves.reset();
    this.endless = false;
    this.startHiScore = this.score.hiScore;
    this.vfx.reset();
    this.engine.input.flush();
    this.hud.hideMenu();
    this.hud.setHudVisible(true);
    this.hud.setHint('');
    this.engine.composer.setVignetteTint(COLORS.RED, 0, RENDER.retro.vignetteColor);
    this.state.set(States.WAVE_INTRO, { wave: 1 });
  }

  /** Shared per-frame visual update used by every in-game state. */
  _updateWorld(dt, { pressure = true } = {}) {
    this.formation.update(dt);
    this.player.update(dt, this.vfx);
    this.ufo.update(dt);
    this.projectiles.update();
    this.powerups.update(dt);

    if (pressure) {
      const lowest = this.formation.lowestY();
      this.pressure = Number.isFinite(lowest) ? clamp((WORLD.BUNKER_Y + 2 - lowest) / 8, 0, 1) : 0;
      this.environment.setPressure(this.pressure);
      this.engine.composer.setVignetteTint(COLORS.RED, this.pressure * 0.35, RENDER.retro.vignetteColor);
      const intensity = 0.35 + 0.65 * this.pressure;
      if (Math.abs(intensity - this._lastIntensity) > 0.02) {
        this._lastIntensity = intensity;
        this.sound.setIntensity(intensity);
      }
    }
    this.environment.update(dt);
    this.sound.update();

    const rig = this.engine.rig;
    const lean = this.player.alive ? this.player.x * WORLD.VIEW.parallax : 0;
    rig.offset.x = damp(rig.offset.x, lean, 4, dt);

    this._hudUpdate();
  }

  _hudUpdate() {
    this.hud.update({
      score: this.score.score,
      hiScore: this.score.hiScore,
      wave: Math.max(1, this.waves.wave),
      lives: this.score.lives,
      multiplier: this.score.multiplier,
      comboProgress: this.score.comboProgress,
      power: { type: this.player.power.type, timer: this.player.power.timer, duration: POWERUPS.DURATION },
      shield: this.player.shield,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GameBase lifecycle.

  fixedUpdate(step) {
    this.state.fixedUpdate(step);
  }

  update(dt, realDt) {
    this.state.update(dt);
  }

  onResize(width, height) {
    const cam = this.engine.camera;
    const v = WORLD.VIEW;
    const t = Math.tan(degToRad(cam.fov) * 0.5);
    const aspect = Math.max(0.1, width / Math.max(1, height));
    const distH = v.halfH / t;
    const distW = v.halfW / (t * aspect);
    const dist = Math.max(distH, distW) * v.margin;
    _camPos.set(0, v.centerY + v.cameraLift, dist);
    _camTarget.set(0, v.centerY, 0);
    this.engine.rig.setBase(_camPos, _camTarget);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public helpers (also used by the DEV inspection hook to drive both endings).

  /** Snapshot of the observable game state. */
  snapshot() {
    return {
      state: this.state.current,
      wave: this.waves.wave,
      score: this.score.score,
      hiScore: this.score.hiScore,
      lives: this.score.lives,
      invaders: this.formation.aliveCount,
      bunkerCells: this.bunkers.liveCells,
      playerX: this.player.x,
      playerAlive: this.player.alive,
      playerBullets: this.projectiles.playerLiveCount,
      invaderBullets: this.projectiles.invaderLiveCount,
      particles: this.vfx.particles.activeCount,
      pressure: this.pressure,
      endless: this.endless,
      timeScale: this.engine.timeScale,
    };
  }

  /** Destroy every living invader (smart-bomb). Only meaningful during PLAY. */
  killAll() {
    if (!this.state.is(States.PLAY)) return 0;
    let n = 0;
    for (let i = 0; i < this.formation.total && this.state.is(States.PLAY); i++) {
      if (this.formation.alive[i]) {
        this._onInvaderHit(i);
        n++;
      }
    }
    return n;
  }

  /** Force a cannon hit as if struck by a shot. Only meaningful during PLAY. */
  forceHit() {
    if (!this.state.is(States.PLAY)) return false;
    this._onPlayerHit(this.player.x, this.player.y, 'debug');
    return true;
  }

  dispose() {
    for (const off of this._subs) off();
    this._subs = [];
    this.score.flush();
    this.sound.dispose();
    this.hud.dispose();
    this.projectiles.dispose();
    this.powerups.dispose();
    this.ufo.dispose();
    this.player.dispose();
    this.bunkers.dispose();
    this.formation.dispose();
    this.environment.dispose();
    this.tracker.dispose();
    super.dispose();
  }
}
