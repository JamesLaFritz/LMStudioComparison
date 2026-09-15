import * as THREE from 'three';
import { pick } from '../shared/utils/Math.js';
import { Player } from './Player.js';
import { InvaderFormation } from './InvaderFormation.js';
import { Barricade } from './Barricade.js';
import { Bullets } from './Bullets.js';
import { UFO } from './UFO.js';
import { PowerUp } from './PowerUp.js';

const INVASION_LINE = 2.2;
const COMBO_WINDOW = 2.5;
const MAX_LIVES = 5;
const MAX_WAVE = 10;

/**
 * Game — the state machine and single collision hub for Space Invaders.
 *
 * States: menu → playing ⇄ paused → waveclear → playing …
 *                          ↘ gameover → (restart) → playing
 *
 * Game owns all entities and the fx bundle; entities never import shared VFX
 * classes directly. Every hit is routed here: score, combo, VFX, audio, and
 * state transitions all flow through one place.
 */
export class Game {
  constructor({ scene, input, ui, fx, audio, arena }) {
    this.scene = scene;
    this.input = input;
    this.ui = ui;
    this.fx = fx; // { particles, shake, hitStop, shockwave, text }
    this.audio = audio;
    this.arena = arena;

    this.state = 'menu';
    this.score = 0;
    this.best = 0;
    this.lives = 3;
    this.wave = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.waveTime = 0;
    this.stateTimer = 0;
    this.oneUpAwarded = false;
    this._ufoTimer = 0;
    this._ufoNext = 12 + Math.random() * 12;

    this.player = new Player(scene, input, fx);
    this.formation = new InvaderFormation(scene, fx);
    this.barricade = new Barricade(scene);
    this.bullets = new Bullets(scene);
    this.ufo = new UFO(scene, fx);
    this.powerups = new PowerUp(scene);

    this._wireUI();
    this._setState('menu');
  }

  _wireUI() {
    this.ui.onAction('start', () => this.startGame());
    this.ui.onAction('resume', () => this._setState('playing'));
    this.ui.onAction('restart', () => this.startGame());
    this.ui.onAction('next', () => this._advanceWave());
  }

  // ── lifecycle ──────────────────────────────────────────────────────────

  startGame() {
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.oneUpAwarded = false;
    this._resetWave();
    this._setState('playing');
    this.ui.setScore(this.score);
    this.ui.setLives(this.lives);
    this.ui.setWave(this.wave);
    this.ui.setCombo(1, 0);
    this.ui.banner('WAVE 1', 1400);
    this.audio.startMarch(90);
  }

  _resetWave() {
    this.waveTime = 0;
    this._ufoTimer = 0;
    this._ufoNext = 12 + Math.random() * 12;
    this.player.reset();
    this.formation.reset(this.wave);
    this.barricade.reset();
    this.bullets.clearAll();
    this.ufo.deactivate();
    this.powerups.clear();
  }

  _advanceWave() {
    if (this.state !== 'waveclear') return;
    this.wave += 1;
    this._resetWave();
    this._setState('playing');
    this.ui.setWave(this.wave);
    this.ui.banner(`WAVE ${this.wave}`, 1400);
    this.audio.startMarch(90);
  }

  _setState(s) {
    this.state = s;
    this.stateTimer = 0;
    if (s === 'playing') {
      this.ui.hideScreens();
      this.audio.resume();
    } else if (s === 'menu') {
      this.ui.showScreen('menu');
      this.audio.stopMarch();
    } else if (s === 'paused') {
      this.ui.showScreen('pause');
      this.audio.suspend();
    } else if (s === 'waveclear') {
      this.ui.showScreen('waveClear');
      this.ui.setStats('wave-clear-stats',
        `Wave ${this.wave} cleared · Score ${this.score} · Best ${this.best}`);
      this.audio.stopMarch();
    } else if (s === 'gameover') {
      this.best = Math.max(this.best, this.score);
      this.ui.showScreen('gameOver');
      this.ui.setStats('gameover-stats',
        `Score ${this.score} · Best ${this.best} · Reached wave ${this.wave}`);
      this.audio.stopMarch();
      this.audio.sfx('gameOver');
    } else if (s === 'victory') {
      this.best = Math.max(this.best, this.score);
      this.ui.showScreen('victory');
      this.ui.setStats('victory-stats',
        `Final score ${this.score} · Best ${this.best} · All ${MAX_WAVE} waves repelled`);
      this.audio.stopMarch();
      this.audio.sfx('waveClear');
    }
  }

  // ── per-frame ──────────────────────────────────────────────────────────

  update(dt, realDt) {
    // Pause toggle on the edge, in any state that has a game.
    if (this.input.pressed('pause') && (this.state === 'playing' || this.state === 'paused')) {
      if (this.state === 'playing') this._setState('paused');
      else this._setState('playing');
      return;
    }

    if (this.state === 'menu') {
      if (this.input.pressed('start') || this.input.pressed('fire')) this.startGame();
      return;
    }

    if (this.state === 'gameover' || this.state === 'victory') {
      if (this.input.pressed('start') || this.input.pressed('fire')) this.startGame();
      return;
    }

    if (this.state === 'waveclear') {
      this.stateTimer += realDt;
      if (this.stateTimer > 2.6) this._advanceWave();
      return;
    }

    if (this.state === 'paused') return;

    // ── PLAYING ──
    this.waveTime += dt;

    this.player.update(dt, this.input.axisX());
    this.formation.update(dt, this.wave);
    this.barricade.update(dt);
    this.bullets.update(dt);
    this.ufo.update(dt);
    this.powerups.update(dt);

    this._playerFire();
    this._enemyFire();
    this._collisions();

    // UFO: one crossing per wave, after a random 12–24 s delay.
    if (!this.ufo.active) {
      this._ufoTimer += dt;
      if (this._ufoTimer >= this._ufoNext) {
        this._ufoTimer = 0;
        this._ufoNext = 12 + Math.random() * 12;
        this.ufo.launch(3.0 + 0.3 * this.wave);
      }
    }

    // Invasion check — any live invader crossing the line is a loss.
    if (this.formation.alive > 0 && this.formation.checkInvasion(INVASION_LINE)) {
      this._onInvasion();
      return;
    }

    // Wave clear.
    if (this.formation.alive === 0) {
      this._onWaveClear();
      return;
    }

    this._updateCombo(dt);
    this._updateMarchTempo();
    this._syncHud();
  }

  _playerFire() {
    if (!this.input.held('fire')) return;
    if (!this.player.tryFire()) return;
    const wide = this.player.wide > 0;
    if (this.bullets.firePlayer(this.player.x, this.player.y + 0.6, wide)) {
      this.audio.sfx('laser');
    }
  }

  _enemyFire() {
    const prob = Math.min(0.85, 0.30 + 0.06 * this.wave);
    const shooter = this.formation.pickFiringInvader(prob);
    if (!shooter) return;
    const speed = 8.5 + 0.75 * this.wave;
    if (this.bullets.fireEnemy(shooter.x, shooter.y - 0.5, speed)) {
      this.audio.sfx('enemyLaser');
    }
  }

  _updateCombo(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
        this.ui.setCombo(1, 0);
      }
    }
  }

  _updateMarchTempo() {
    // The march accelerates as the formation dies and the wave climbs.
    const interval = this.formation.stepInterval(this.wave);
    const bpm = Math.round(60 / Math.max(0.05, interval));
    this.audio.setMarchBpm(bpm);
  }

  _syncHud() {
    this.ui.setScore(this.score);
    this.ui.setLives(this.lives);
    this.ui.setWave(this.wave);
    const mult = 1 + Math.min(7, Math.floor(this.combo / 4));
    const frac = this.comboTimer > 0 ? this.comboTimer / COMBO_WINDOW : 0;
    this.ui.setCombo(mult, frac);
    this.ui.setPowerups(this.player.powerupList());
  }

  // ── collisions (single hub) ────────────────────────────────────────────

  _collisions() {
    const { bullets, formation, barricade, player, ufo, powerups } = this;

    // 1. Player bullets vs UFO (priority — bonus craft).
    bullets.forEachPlayer((b) => {
      if (ufo.active && ufo.hit(b.mesh.position.x, b.mesh.position.y)) {
        this.bullets.releasePlayer(b);
        this._onUfoKill(ufo.x, ufo.y, ufo.score);
      }
    });

    // 2. Player bullets vs invaders.
    bullets.forEachPlayer((b) => {
      if (!b.active) return;
      const inv = formation.hitAt(b.mesh.position.x, b.mesh.position.y, b.halfX, b.halfY);
      if (inv) {
        this.bullets.releasePlayer(b);
        this._onInvaderDeath(inv);
      }
    });

    // 3. Player bullets vs bunkers.
    bullets.forEachPlayer((b) => {
      if (!b.active) return;
      const cell = barricade.hitAt(b.mesh.position.x, b.mesh.position.y, b.halfX, b.halfY);
      if (cell) {
        this.bullets.releasePlayer(b);
        this._onBunkerHit(cell, false);
      }
    });

    // 4. Enemy bullets vs player.
    bullets.forEachEnemy((b) => {
      if (!b.active) return;
      if (!player.invulnerable && player.alive
        && this._aabb(b.mesh.position.x, b.mesh.position.y, b.halfX, b.halfY,
                      player.x, player.y, player.halfWidth, player.halfHeight)) {
        this.bullets.releaseEnemy(b);
        this._onPlayerHit();
      }
    });

    // 5. Enemy bullets vs bunkers.
    bullets.forEachEnemy((b) => {
      if (!b.active) return;
      const cell = barricade.hitAt(b.mesh.position.x, b.mesh.position.y, b.halfX, b.halfY);
      if (cell) {
        this.bullets.releaseEnemy(b);
        this._onBunkerHit(cell, true);
      }
    });

    // 6. Invaders eat bunkers.
    formation.forEachAlive((inv) => {
      barricade.destroyOverlapping(inv.x, inv.y, 0.55, 0.45, (cell) => this._onBunkerEaten(cell));
    });

    // 7. Power-ups vs player.
    const collected = powerups.testCollect(player.x, player.y, 1.0, 0.6);
    if (collected) this._onPowerupPickup(collected);
  }

  _aabb(ax, ay, ahw, ahh, bx, by, bhw, bhh) {
    return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
  }

  // ── event handlers ─────────────────────────────────────────────────────

  _registerKill(baseScore, x, y) {
    this.combo += 1;
    this.comboTimer = COMBO_WINDOW;
    const mult = 1 + Math.min(7, Math.floor(this.combo / 4));
    const total = baseScore * mult;
    this.score += total;
    this.ui.setCombo(mult, 1);
    this.fx.text.spawn({
      position: new THREE.Vector3(x, y, 0),
      text: `+${total}${mult > 1 ? ` ×${mult}` : ''}`,
      color: mult > 1 ? '#ffe14d' : '#9dffb0',
    });
    if (!this.oneUpAwarded && this.score >= 1000 && this.lives < MAX_LIVES) {
      this.lives += 1;
      this.oneUpAwarded = true;
      this.ui.setLives(this.lives);
      this.ui.banner('1-UP', 1600);
      this.fx.text.spawn({ position: new THREE.Vector3(0, 6, 0), text: '1-UP', color: '#7df9ff', size: 22 });
      this.audio.sfx('powerup');
    }
    return total;
  }

  _onInvaderDeath(inv) {
    this.formation.kill(inv);
    this._registerKill(inv.score, inv.x, inv.y);
    this.fx.particles.burst({
      position: new THREE.Vector3(inv.x, inv.y, 0),
      count: 24,
      colors: [inv.color, 0xffffff],
      speed: [3, 9],
      gravity: -6,
      life: [0.5, 0.9],
      size: [0.06, 0.14],
      priority: 2,
    });
    this.fx.shockwave.spawn({
      position: new THREE.Vector3(inv.x, inv.y, 0),
      color: inv.color,
      maxRadius: 1.6,
      duration: 0.45,
    });
    this.fx.shake.add(0.18 + 0.02 * (4 - inv.row));
    this.fx.hitStop.trigger(0.06, 0.08);
    this.audio.sfx('explosion');
    this.arena.flash(new THREE.Vector3(inv.x, inv.y, 0), 40, 0.25, inv.color);
    this._maybeDropPowerup(inv.x, inv.y);
  }

  _onUfoKill(x, y, score) {
    // UFO.kill() handles its own VFX (particles, shockwave, shake, hit-stop, siren off).
    this.ufo.kill();
    this._registerKill(score, x, y);
    this.arena.flash(new THREE.Vector3(x, y, 0), 70, 0.3, 0xff3b6b);
  }

  _onBunkerHit(cell, byEnemy) {
    const destroyed = !cell.alive;
    this.fx.particles.burst({
      position: new THREE.Vector3(cell.x, cell.y, 0),
      count: destroyed ? 10 : 5,
      colors: [0x39ff88, 0x0d3320],
      speed: [2, 6],
      gravity: -8,
      life: [0.3, 0.6],
      size: [0.04, 0.1],
      priority: 1,
    });
    if (destroyed) {
      this.fx.shake.add(0.08);
      this.audio.sfx('explosion');
    } else {
      this.audio.sfx('enemyLaser');
    }
  }

  _onBunkerEaten(cell) {
    this.fx.particles.burst({
      position: new THREE.Vector3(cell.x, cell.y, 0),
      count: 8,
      colors: [0x39ff88, 0x0d3320],
      speed: [2, 5],
      gravity: -6,
      life: [0.3, 0.5],
      size: [0.04, 0.09],
      priority: 1,
    });
    this.audio.sfx('explosion');
  }

  _onPlayerHit() {
    // Shield absorbs the hit (player.hit() flips the shield off + grants 1 s invuln).
    if (this.player.hit()) {
      this.fx.shockwave.spawn({
        position: new THREE.Vector3(this.player.x, this.player.y, 0),
        color: 0x7dff6a,
        maxRadius: 2.2,
        duration: 0.4,
      });
      this.fx.shake.add(0.25);
      this.audio.sfx('shield');
      return;
    }

    this.lives -= 1;
    this.ui.setLives(this.lives);
    this.combo = 0;
    this.comboTimer = 0;
    this.ui.setCombo(1, 0);
    this.player.explode();
    this.fx.shake.add(1.0);
    this.fx.hitStop.trigger(0.14, 0.04);
    this.audio.sfx('playerDeath');
    this.arena.flash(new THREE.Vector3(this.player.x, this.player.y, 0), 80, 0.35, 0x00e5ff);
    if (this.lives <= 0) {
      this._setState('gameover');
    } else {
      this.player.respawn();
    }
  }

  _onInvasion() {
    // The formation reached the player line — total loss.
    this.lives = 0;
    this.ui.setLives(0);
    this.fx.shake.add(1.0);
    this.fx.hitStop.trigger(0.14, 0.04);
    this.audio.sfx('playerDeath');
    this._setState('gameover');
  }

  _onWaveClear() {
    const bonus = 100 * this.wave;
    this.score += bonus;
    this.ui.setScore(this.score);
    this.fx.text.spawn({ position: new THREE.Vector3(0, 7, 0), text: `WAVE CLEAR +${bonus}`, color: '#7df9ff', size: 20 });
    this.audio.sfx('waveClear');
    if (this.wave >= MAX_WAVE) {
      this._setState('victory');
    } else {
      this._setState('waveclear');
    }
  }

  _maybeDropPowerup(x, y) {
    if (Math.random() > 0.12) return;
    const type = pick(['RAPID', 'WIDE', 'SHIELD', 'BOMB']);
    this.powerups.spawn(x, y, type);
  }

  _onPowerupPickup(p) {
    this.player.applyPowerup(p.type);
    const css = this.powerups.colorOf(p.type);
    const hex = parseInt(css.slice(1), 16);
    this.fx.text.spawn({
      position: new THREE.Vector3(p.x, p.y + 0.4, 0),
      text: p.type,
      color: css,
    });
    this.fx.particles.burst({
      position: new THREE.Vector3(p.x, p.y, 0),
      count: 12,
      colors: [hex, 0xffffff],
      speed: [2, 6],
      gravity: -2,
      life: [0.4, 0.8],
      size: [0.05, 0.12],
      priority: 1,
    });
    this.fx.shake.add(0.12);
    this.audio.sfx('powerup');
    if (p.type === 'BOMB') {
      this.bullets.clearEnemy();
      this.fx.shockwave.spawn({ position: new THREE.Vector3(this.player.x, this.player.y, 0), color: 0xff2fd6, maxRadius: 14, duration: 0.8 });
      this.fx.hitStop.trigger(0.1, 0.06);
      this.fx.shake.add(0.7);
      this.audio.sfx('bomb');
    }
  }

  // ── teardown ───────────────────────────────────────────────────────────

  dispose() {
    this.player.dispose(this.scene);
    this.formation.dispose();
    this.barricade.dispose();
    this.bullets.dispose();
    this.ufo.dispose();
    this.powerups.dispose();
  }
}
