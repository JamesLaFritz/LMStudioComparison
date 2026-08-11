import * as THREE from 'three';
import { PongPaddle } from './PongPaddle.js';
import { PongBall } from './PongBall.js';
import { PongArena } from './PongArena.js';
import { PongHUD } from './PongHUD.js';
import { GameEngine } from '../../shared/core/GameEngine.js';
import { InputManager } from '../../shared/core/InputManager.js';
import { ParticleManager } from '../../shared/vfx/ParticleManager.js';
import { CameraShake } from '../../shared/vfx/CameraShake.js';
import { ShockwaveRing } from '../../shared/vfx/ShockwaveRing.js';
import { FloatingText3D } from '../../shared/vfx/FloatingText3D.js';
import { AudioSynth } from '../../shared/audio/AudioSynth.js';
import { ResourceManager } from '../../shared/core/ResourceManager.js';

const STATES = { MENU: 0, SERVE: 1, PLAYING: 2, SCORED: 3, MATCH_OVER: 4 };
const WIN_SCORE = 7;
const SERVE_DELAY = 1.0;
const SCORE_DELAY = 1.5;

export class PongGame {
  constructor() {
    this.state = STATES.MENU;
    this.stateTimer = 0;
    this.scoreP1 = 0;
    this.scoreP2 = 0;
    this.serveDir = 1;
    this.paddle1 = null;
    this.paddle2 = null;
    this.ball = null;
    this.arena = null;
    this.hud = null;
    this.victoryTimer = 0;
    this.victoryPhase = 0;
  }

  init(scene, camera, composer) {
    this.scene = scene;
    this.camera = camera;
    this.composer = composer;

    // Build arena
    this.arena = new PongArena();
    this.arena.build(scene);

    // Create paddles
    this.paddle1 = new PongPaddle(scene, -7.0, 0xff00ff, 'left');
    this.paddle2 = new PongPaddle(scene, 7.0, 0x00ff88, 'right');

    // Create ball
    this.ball = new PongBall(scene);

    // Create HUD
    this.hud = new PongHUD();
    this.hud.init();

    // Initial state
    this.state = STATES.MENU;
    this.hud.showMenu();
    this.hud.updateScores(0, 0);
  }

  update(dt) {
    this.stateTimer += dt;

    switch (this.state) {
      case STATES.MENU:
        this.updateMenu(dt);
        break;
      case STATES.SERVE:
        this.updateServe(dt);
        break;
      case STATES.PLAYING:
        this.updatePlaying(dt);
        break;
      case STATES.SCORED:
        this.updateScored(dt);
        break;
      case STATES.MATCH_OVER:
        this.updateMatchOver(dt);
        break;
    }

    // Always update paddles (they move in all states except MENU)
    if (this.state !== STATES.MENU) {
      this.updatePaddles(dt);
    }

    // Update ball trail
    if (this.ball) {
      this.ball.updateTrail(dt);
    }

    // Update HUD
    if (this.hud) {
      this.hud.update(dt);
    }
  }

  updateMenu(dt) {
    // Wait for any key press to start
    const input = InputManager.getInstance();
    if (input.isKeyJustPressed('KeyW') || input.isKeyJustPressed('ArrowUp') ||
        input.isKeyJustPressed('Enter') || input.isGamepadButtonJustPressed(0)) {
      // Init audio on first user interaction
      AudioSynth.getInstance().init();
      AudioSynth.getInstance().playStart();
      this.startServe();
    }
  }

  updateServe(dt) {
    // Paddles can move during serve
    if (this.stateTimer >= SERVE_DELAY) {
      this.state = STATES.PLAYING;
      this.stateTimer = 0;
      this.ball.launch(this.serveDir * 5.0, (Math.random() - 0.5) * 3.0);
      AudioSynth.getInstance().playServe();
    }
  }

  updatePlaying(dt) {
    // Update ball physics
    this.ball.update(dt);

    // Check paddle collisions
    this.checkPaddleCollision(this.paddle1);
    this.checkPaddleCollision(this.paddle2);

    // Check wall collisions
    this.checkWallCollisions();

    // Check scoring
    if (this.ball.position.x < -8.5) {
      this.scorePoint(2);
    } else if (this.ball.position.x > 8.5) {
      this.scorePoint(1);
    }
  }

  updateScored(dt) {
    if (this.stateTimer >= SCORE_DELAY) {
      // Check for match over
      if (this.scoreP1 >= WIN_SCORE || this.scoreP2 >= WIN_SCORE) {
        this.state = STATES.MATCH_OVER;
        this.stateTimer = 0;
        this.victoryTimer = 0;
        this.victoryPhase = 0;
        this.hud.showMatchOver(this.scoreP1 >= WIN_SCORE ? 1 : 2);
        AudioSynth.getInstance().playVictory();
      } else {
        this.startServe();
      }
    }
  }

  updateMatchOver(dt) {
    this.victoryTimer += dt;

    // Victory sequence: pulse winning paddle
    const winner = this.scoreP1 >= WIN_SCORE ? this.paddle1 : this.paddle2;
    const pulse = Math.sin(this.victoryTimer * 10) * 0.5 + 0.5;
    winner.mesh.material.emissiveIntensity = 1.0 + pulse * 3.0;

    // Particle fountain during victory
    if (Math.floor(this.victoryTimer * 10) % 3 === 0) {
      const winnerColor = this.scoreP1 >= WIN_SCORE ? 0xff00ff : 0x00ff88;
      ParticleManager.getInstance().burst(
        winner.mesh.position.clone(),
        5,
        winnerColor,
        2.0,
        0.8
      );
    }

    // Reset after 5 seconds
    if (this.victoryTimer > 5.0 &&
        (InputManager.getInstance().isKeyJustPressed('Enter') ||
         InputManager.getInstance().isGamepadButtonJustPressed(0))) {
      this.resetMatch();
    }
  }

  updatePaddles(dt) {
    const input = InputManager.getInstance();

    // Player 1: W/S or gamepad 0 left stick
    let p1Axis = 0;
    if (input.isKeyDown('KeyW') || input.isKeyDown('ArrowUp')) p1Axis = 1;
    if (input.isKeyDown('KeyS') || input.isKeyDown('ArrowDown')) p1Axis = -1;
    const gp0 = input.getGamepad(0);
    if (gp0) {
      const stickY = gp0.leftStickY;
      if (Math.abs(stickY) > 0.12) p1Axis = stickY;
    }
    this.paddle1.move(p1Axis, dt);

    // Player 2: Arrow keys or gamepad 0 right stick (or gamepad 1)
    let p2Axis = 0;
    const gp1 = input.getGamepad(1);
    if (gp1) {
      const stickY = gp1.leftStickY;
      if (Math.abs(stickY) > 0.12) p2Axis = stickY;
    }
    // If no second gamepad, right stick of first gamepad controls P2
    if (gp0 && !gp1) {
      const stickY = gp0.rightStickY;
      if (Math.abs(stickY) > 0.12) p2Axis = stickY;
    }
    this.paddle2.move(p2Axis, dt);
  }

  checkPaddleCollision(paddle) {
    const ballPos = this.ball.position;
    const paddlePos = paddle.mesh.position;
    const paddleHalfW = 0.15;
    const paddleHalfH = 1.0;
    const ballRadius = 0.18;

    // AABB check
    if (Math.abs(ballPos.x - paddlePos.x) < paddleHalfW + ballRadius &&
        Math.abs(ballPos.y - paddlePos.y) < paddleHalfH + ballRadius) {
      // Reflect ball
      const oldVx = this.ball.velocity.x;
      this.ball.velocity.x = -this.ball.velocity.x * 1.05;

      // Add angle based on hit offset
      const hitOffset = ballPos.y - paddlePos.y;
      this.ball.velocity.y += hitOffset * 1.8;

      // Clamp speed
      const speed = this.ball.velocity.length();
      if (speed > 14.0) {
        this.ball.velocity.normalize().multiplyScalar(14.0);
      }

      // Ensure minimum x velocity
      if (Math.abs(this.ball.velocity.x) < 2.0) {
        this.ball.velocity.x = this.ball.velocity.x > 0 ? 2.0 : -2.0;
      }

      // Push ball out of paddle
      if (paddle.side === 'left') {
        this.ball.position.x = paddlePos.x + paddleHalfW + ballRadius + 0.01;
      } else {
        this.ball.position.x = paddlePos.x - paddleHalfW - ballRadius - 0.01;
      }

      // VFX
      const impactSpeed = Math.abs(oldVx);
      CameraShake.getInstance().trigger(0.15 + impactSpeed * 0.01, 0.15);
      GameEngine.triggerHitStop(0.06);

      const burstCount = Math.min(25 + Math.floor(impactSpeed), 40);
      ParticleManager.getInstance().burst(
        this.ball.position.clone(),
        burstCount,
        paddle.color,
        2.0,
        0.6
      );

      ShockwaveRing.spawn(this.ball.position.clone(), 2.0, 0.4, paddle.color);
      AudioSynth.getInstance().playHit();
    }
  }

  checkWallCollisions() {
    const ballPos = this.ball.position;
    const ballRadius = 0.18;
    const wallLimit = 4.5;

    if (ballPos.y > wallLimit - ballRadius) {
      this.ball.velocity.y = -Math.abs(this.ball.velocity.y);
      this.ball.position.y = wallLimit - ballRadius;
      CameraShake.getInstance().trigger(0.08, 0.1);
      ParticleManager.getInstance().burst(this.ball.position.clone(), 10, 0x00ffff, 1.5, 0.4);
      AudioSynth.getInstance().playWallHit();
    } else if (ballPos.y < -wallLimit + ballRadius) {
      this.ball.velocity.y = Math.abs(this.ball.velocity.y);
      this.ball.position.y = -wallLimit + ballRadius;
      CameraShake.getInstance().trigger(0.08, 0.1);
      ParticleManager.getInstance().burst(this.ball.position.clone(), 10, 0x00ffff, 1.5, 0.4);
      AudioSynth.getInstance().playWallHit();
    }
  }

  scorePoint(scorer) {
    this.state = STATES.SCORED;
    this.stateTimer = 0;

    if (scorer === 1) {
      this.scoreP1++;
      this.serveDir = -1;
    } else {
      this.scoreP2++;
      this.serveDir = 1;
    }

    this.hud.updateScores(this.scoreP1, this.scoreP2);

    // VFX
    const scorerColor = scorer === 1 ? 0xff00ff : 0x00ff88;
    const scorerPos = scorer === 1 ? new THREE.Vector3(-7, 0, 0) : new THREE.Vector3(7, 0, 0);

    GameEngine.triggerHitStop(0.2);
    CameraShake.getInstance().trigger(0.3, 0.3);

    ParticleManager.getInstance().burst(scorerPos.clone(), 80, 0xffffff, 5.0, 1.2);
    ShockwaveRing.spawn(scorerPos.clone(), 6.0, 0.8, scorerColor);
    FloatingText3D.spawn(scorerPos.clone(), '+1', scorerColor, 1.5);

    AudioSynth.getInstance().playScore();
  }

  startServe() {
    this.state = STATES.SERVE;
    this.stateTimer = 0;
    this.ball.reset();
    this.hud.showServe();
  }

  resetMatch() {
    this.scoreP1 = 0;
    this.scoreP2 = 0;
    this.serveDir = 1;
    this.state = STATES.MENU;
    this.stateTimer = 0;
    this.victoryTimer = 0;

    // Reset paddle visuals
    this.paddle1.mesh.material.emissiveIntensity = 1.0;
    this.paddle2.mesh.material.emissiveIntensity = 1.0;

    this.hud.updateScores(0, 0);
    this.hud.showMenu();
    this.ball.reset();
  }

  dispose() {
    if (this.arena) this.arena.dispose();
    if (this.paddle1) this.paddle1.dispose();
    if (this.paddle2) this.paddle2.dispose();
    if (this.ball) this.ball.dispose();
    if (this.hud) this.hud.dispose();
  }
}
