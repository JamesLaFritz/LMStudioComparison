import * as THREE from 'three';
import { Renderer } from '../shared/Rendering/Renderer.js';
import { InputController } from '../shared/Input/InputController.js';
import { ParticleManager } from '../shared/VFX/ParticleManager.js';
import { CameraShake } from '../shared/VFX/CameraShake.js';
import { HitStop } from '../shared/VFX/HitStop.js';
import { MotionTrails } from '../shared/VFX/MotionTrails.js';
import { ShockwaveRings } from '../shared/VFX/ShockwaveRings.js';
import { FloatingScoreText } from '../shared/VFX/FloatingScoreText.js';
import { AudioEngine } from '../shared/Audio/AudioEngine.js';
import { TextureGen } from '../shared/Procedural/TextureGen.js';
import { ComposerSetup } from '../shared/PostProcessing/ComposerSetup.js';
import { GlassmorphismUI } from '../shared/UI/GlassmorphismUI.js';

/**
 * PONG — AAA Retro-Futurism Edition
 * Full physics, PBR rendering, bloom, trails, particles, shake, hit-stop, shockwaves, floating text.
 */
export class PongGame {
  constructor(container) {
    this.container = container;
    this.running = false;
    this.scored = false;
    this.gameOver = false;

    // Court dimensions (world units)
    this.courtWidth = 20;
    this.courtHeight = 12;
    this.courtDepth = 0.3;

    // Paddle
    this.paddleWidth = 1.6;
    this.paddleHeight = 0.25;
    this.paddleDepth = 0.4;
    this.paddleSpeed = 14;
    this.paddleMargin = 0.8;

    // Ball
    this.ballRadius = 0.22;
    this.ballSpeed = 5;
    this.ballMaxSpeed = 10;
    this.ballSpeedIncrement = 0.15;
    this.maxBounceAngle = Math.PI / 3.5;

    // AI
    this.aiLerpFactor = 5.5;
    this.aiReactionOffset = 0;
    this.aiReactionTimer = 0;

    // Scoring
    this.maxScore = 7;
    this.playerScore = 0;
    this.aiScore = 0;
    this.serveSide = 1; // 1 = player serves, -1 = ai serves

    // Timers
    this.serveTimer = 0;
    this.serveDelay = 1.2;
    this.pulseTimer = 0;

    // References
    this.renderer = null;
    this.input = null;
    this.particles = null;
    this.shake = null;
    this.hitStop = null;
    this.trails = null;
    this.shockwaves = null;
    this.floatingText = null;
    this.audio = null;
    this.ui = null;

    // Scene objects
    this.ball = null;
    this.ballLight = null;
    this.playerPaddle = null;
    this.aiPaddle = null;
    this.courtFloor = null;
    this.centerLine = null;
    this.wallLeft = null;
    this.wallRight = null;

    // Ball velocity
    this.ballVx = 0;
    this.ballVy = 0;

    // Paddle velocities (for spin)
    this.playerPaddleVel = 0;
    this.aiPaddleVel = 0;
    this.prevPlayerY = 0;
    this.prevAiY = 0;

    this._init();
  }

  // ─── Initialization ───────────────────────────────────────────────

  _init() {
    // Renderer with post-processing
    this.renderer = new Renderer(this.container);
    this.renderer.enablePostProcessing({
      threshold: 0.7,
      strength: 1.4,
      radius: 0.6,
    });

    // Shared systems
    this.input = new InputController();
    this.particles = new ParticleManager(this.renderer.scene, 500);
    this.shake = new CameraShake(this.renderer.camera);
    this.hitStop = new HitStop();
    this.trails = new MotionTrails(this.renderer.scene);
    this.shockwaves = new ShockwaveRings(this.renderer.scene);
    this.floatingText = new FloatingScoreText(this.container);
    this.audio = new AudioEngine();

    // UI
    this.ui = new GlassmorphismUI(this.container);
    this.ui.createScorePanel('0', '0');
    this.ui.createTitlePanel('PONG', 'RETRO-FUTURISM EDITION');
    this.ui.createStatusPanel('Press SPACE or tap to start');

    // Build scene
    this._buildCourt();
    this._buildPaddles();
    this._buildBall();
    this._buildLighting();
    this._buildBackground();

    // Camera
    this.renderer.camera.position.set(0, 0, 18);
    this.renderer.camera.lookAt(0, 0, 0);

    // Start loop
    this.running = true;
    this.lastTime = performance.now();
    this._resetBall();
    this._animate();
  }

  // ─── Scene Construction ───────────────────────────────────────────

  _buildCourt() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(this.courtWidth + 2, this.courtHeight + 2);
    const floorTex = TextureGen.createGridTexture(512, 512, 0x0a0a2e, 0x1a1a4e, 16, 16);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.7,
      metalness: 0.3,
      emissive: 0x050520,
      emissiveIntensity: 0.3,
    });
    this.courtFloor = new THREE.Mesh(floorGeo, floorMat);
    this.courtFloor.rotation.x = -Math.PI / 2;
    this.courtFloor.position.z = -0.5;
    this.renderer.scene.add(this.courtFloor);

    // Center line (dashed glow strip)
    const lineGeo = new THREE.PlaneGeometry(0.08, this.courtHeight);
    const lineMat = new THREE.MeshStandardMaterial({
      emissive: 0x4444ff,
      emissiveIntensity: 2,
      roughness: 0.3,
      metalness: 0.8,
      transparent: true,
      opacity: 0.6,
    });
    this.centerLine = new THREE.Mesh(lineGeo, lineMat);
    this.centerLine.rotation.x = -Math.PI / 2;
    this.centerLine.position.z = -0.49;
    this.renderer.scene.add(this.centerLine);

    // Left wall
    const wallGeo = new THREE.PlaneGeometry(this.courtHeight, 1);
    const wallMat = new THREE.MeshStandardMaterial({
      emissive: 0x0033ff,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.9,
      transparent: true,
      opacity: 0.4,
    });
    this.wallLeft = new THREE.Mesh(wallGeo, wallMat);
    this.wallLeft.position.set(-(this.courtWidth / 2 + 0.5), 0, -0.2);
    this.renderer.scene.add(this.wallLeft);

    // Right wall
    this.wallRight = new THREE.Mesh(wallGeo, wallMat.clone());
    this.wallRight.position.set(this.courtWidth / 2 + 0.5, 0, -0.2);
    this.renderer.scene.add(this.wallRight);
  }

  _buildPaddles() {
    const paddleGeo = new THREE.BoxGeometry(this.paddleWidth, this.paddleHeight, this.paddleDepth);
    paddleGeo.computeBoundingBox();

    // Player paddle (cyan)
    const playerMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 2.5,
      roughness: 0.15,
      metalness: 0.9,
    });
    this.playerPaddle = new THREE.Mesh(paddleGeo, playerMat);
    this.playerPaddle.position.set(-this.courtWidth / 2 + this.paddleMargin, 0, 0);
    this.renderer.scene.add(this.playerPaddle);

    // AI paddle (magenta)
    const aiMat = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      emissiveIntensity: 2.5,
      roughness: 0.15,
      metalness: 0.9,
    });
    this.aiPaddle = new THREE.Mesh(paddleGeo, aiMat);
    this.aiPaddle.position.set(this.courtWidth / 2 - this.paddleMargin, 0, 0);
    this.renderer.scene.add(this.aiPaddle);
  }

  _buildBall() {
    const ballGeo = new THREE.SphereGeometry(this.ballRadius, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x88ccff,
      emissiveIntensity: 4,
      roughness: 0.05,
      metalness: 0.5,
    });
    this.ball = new THREE.Mesh(ballGeo, ballMat);
    this.ball.position.set(0, 0, 0.1);
    this.renderer.scene.add(this.ball);

    // Attached point light
    this.ballLight = new THREE.PointLight(0x88ccff, 3, 8);
    this.ball.add(this.ballLight);

    // Register with trail system
    this.trails.register(this.ball, 0x88ccff, 16, 0.12);
  }

  _buildLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0x222244, 0.4);
    this.renderer.scene.add(ambient);

    // Directional (top-down fill)
    const dir = new THREE.DirectionalLight(0x4466aa, 0.6);
    dir.position.set(0, 5, 10);
    this.renderer.scene.add(dir);

    // Player side light
    const playerLight = new THREE.PointLight(0x00ffff, 2, 15);
    playerLight.position.set(-this.courtWidth / 2, 0, 3);
    this.renderer.scene.add(playerLight);

    // AI side light
    const aiLight = new THREE.PointLight(0xff00ff, 2, 15);
    aiLight.position.set(this.courtWidth / 2, 0, 3);
    this.renderer.scene.add(aiLight);

    // Fog for depth
    this.renderer.scene.fog = new THREE.FogExp2(0x050510, 0.02);
    this.renderer.scene.background = new THREE.Color(0x050510);
  }

  _buildBackground() {
    // Star field (instanced small spheres)
    const starCount = 300;
    const starGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const starMat = new THREE.MeshStandardMaterial({
      emissive: 0xaabbff,
      emissiveIntensity: 1.5,
      roughness: 1,
      metalness: 0,
    });
    const starMesh = new THREE.InstancedMesh(starGeo, starMat, starCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < starCount; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 25,
        -3 - Math.random() * 12
      );
      dummy.scale.setScalar(0.5 + Math.random() * 1.5);
      dummy.updateMatrix();
      starMesh.setMatrixAt(i, dummy.matrix);
    }
    this.renderer.scene.add(starMesh);

    // Receding grid plane (background)
    const bgGeo = new THREE.PlaneGeometry(60, 40);
    const bgTex = TextureGen.createGridTexture(512, 512, 0x020208, 0x0a0a2e, 32, 32);
    const bgMat = new THREE.MeshStandardMaterial({
      map: bgTex,
      emissive: 0x050515,
      emissiveIntensity: 0.2,
      roughness: 1,
      metalness: 0,
    });
    const bgPlane = new THREE.Mesh(bgGeo, bgMat);
    bgPlane.position.z = -8;
    this.renderer.scene.add(bgPlane);
  }

  // ─── Ball Logic ───────────────────────────────────────────────────

  _resetBall() {
    this.ball.position.set(0, 0, 0.1);
    this.ballVx = 0;
    this.ballVy = 0;
    this.ballSpeed = 5;
    this.serveTimer = this.serveDelay;
    this.scored = false;
    this.gameOver = false;

    // Reset ball light color
    this.ball.material.emissive.setHex(0x88ccff);
    this.ballLight.color.setHex(0x88ccff);
  }

  _serveBall() {
    const angle = (Math.random() - 0.5) * (Math.PI / 3);
    this.ballVx = Math.cos(angle) * this.ballSpeed * this.serveSide;
    this.ballVy = Math.sin(angle) * this.ballSpeed;
    this.serveSide *= -1;
    this.audio.playServe();
  }

  _updateBall(dt) {
    if (this.serveTimer > 0) {
      this.serveTimer -= dt;
      if (this.serveTimer <= 0) {
        this._serveBall();
      }
      // Hover animation while waiting
      this.ball.position.z = 0.1 + Math.sin(this.pulseTimer * 3) * 0.05;
      return;
    }

    // Move ball
    this.ball.position.x += this.ballVx * dt;
    this.ball.position.y += this.ballVy * dt;

    // Ceiling / floor bounce
    const halfHeight = this.courtHeight / 2;
    if (this.ball.position.y - this.ballRadius <= -halfHeight) {
      this.ball.position.y = -halfHeight + this.ballRadius;
      this.ballVy = Math.abs(this.ballVy);
      this.shake.trigger(0.06, 'light');
      this.particles.emitBurst(
        this.ball.position.x, this.ball.position.y, 0,
        8, 0x4488ff, 2, 0.4
      );
      this.audio.playWallBounce();
    }
    if (this.ball.position.y + this.ballRadius >= halfHeight) {
      this.ball.position.y = halfHeight - this.ballRadius;
      this.ballVy = -Math.abs(this.ballVy);
      this.shake.trigger(0.06, 'light');
      this.particles.emitBurst(
        this.ball.position.x, this.ball.position.y, 0,
        8, 0x4488ff, 2, 0.4
      );
      this.audio.playWallBounce();
    }

    // Paddle collision — Player
    this._checkPaddleCollision(this.playerPaddle, this.playerPaddleVel, -1);
    // Paddle collision — AI
    this._checkPaddleCollision(this.aiPaddle, this.aiPaddleVel, 1);

    // Scoring — ball past walls
    const halfWidth = this.courtWidth / 2;
    if (this.ball.position.x < -halfWidth - 0.5 && !this.scored) {
      this._score('ai');
    }
    if (this.ball.position.x > halfWidth + 0.5 && !this.scored) {
      this._score('player');
    }

    // Ball z bob
    this.ball.position.z = 0.1 + Math.sin(this.pulseTimer * 4) * 0.03;

    // Color shift based on speed
    const speedRatio = Math.min((this.ballSpeed - 5) / (this.ballMaxSpeed - 5), 1);
    const r = Math.floor(136 + speedRatio * 119);
    const g = Math.floor(204 - speedRatio * 100);
    const b = Math.floor(255 - speedRatio * 100);
    const color = (r << 16) | (g << 8) | b;
    this.ball.material.emissive.setHex(color);
    this.ballLight.color.setHex(color);
  }

  _checkPaddleCollision(paddle, paddleVel, side) {
    const bx = this.ball.position.x;
    const by = this.ball.position.y;
    const px = paddle.position.x;
    const py = paddle.position.y;

    const dx = bx - px;
    const dy = by - py;

    const hitHalfX = this.paddleWidth / 2 + this.ballRadius;
    const hitHalfY = this.paddleHeight / 2 + this.ballRadius;

    if (Math.abs(dx) < hitHalfX && Math.abs(dy) < hitHalfY) {
      // Determine hit side
      const onLeftSide = dx < 0;
      const onRightSide = dx > 0;

      // Only reflect if ball is moving toward this paddle
      if (side === -1 && this.ballVx > 0) return; // player paddle, ball moving away
      if (side === 1 && this.ballVx < 0) return;  // ai paddle, ball moving away

      // Push ball out of paddle
      if (side === -1) {
        this.ball.position.x = px - hitHalfX;
      } else {
        this.ball.position.x = px + hitHalfX;
      }

      // Calculate reflection angle based on hit offset
      const hitOffset = dy / (this.paddleWidth / 2);
      let bounceAngle = hitOffset * this.maxBounceAngle;

      // Add spin from paddle velocity
      const spinFactor = paddleVel * 0.08;
      bounceAngle += spinFactor;

      // Clamp angle
      bounceAngle = Math.max(-this.maxBounceAngle, Math.min(this.maxBounceAngle, bounceAngle));

      // Increase speed
      this.ballSpeed = Math.min(this.ballSpeed + this.ballSpeedIncrement, this.ballMaxSpeed);

      // Set new velocity
      this.ballVx = -Math.cos(bounceAngle) * this.ballSpeed * (side === -1 ? -1 : 1);
      this.ballVy = Math.sin(bounceAngle) * this.ballSpeed;

      // Ensure minimum vertical velocity
      if (Math.abs(this.ballVy) < 1) {
        this.ballVy = (this.ballVy >= 0 ? 1 : -1);
      }

      // VFX
      this.shake.trigger(0.12, 'medium');
      this.particles.emitBurst(
        this.ball.position.x, this.ball.position.y, 0,
        25, side === -1 ? 0x00ffff : 0xff00ff, 3, 0.5
      );
      this.audio.playPaddleHit(Math.abs(hitOffset));
    }
  }

  _score(scorer) {
    this.scored = true;

    if (scorer === 'player') {
      this.playerScore++;
    } else {
      this.aiScore++;
    }

    this.ui.updateScores(this.playerScore.toString(), this.aiScore.toString());

    // Hit-stop
    this.hitStop.trigger(0.35);

    // Camera shake
    this.shake.trigger(0.3, 'heavy');

    // Particles
    const scoreX = scorer === 'player' ? this.courtWidth / 2 : -this.courtWidth / 2;
    this.particles.emitBurst(scoreX, 0, 0, 60, 0xffaa00, 5, 1.0);

    // Shockwave
    this.shockwaves.emit(scoreX, 0, 0xffaa00, 6, 0.8);

    // Floating text
    const text = scorer === 'player' ? 'POINT!' : 'LOST!';
    const color = scorer === 'player' ? '#00ffff' : '#ff00ff';
    this.floatingText.show(text, scoreX, 2, color);

    // Audio
    this.audio.playScore(scorer === 'player');

    // Check game over
    if (this.playerScore >= this.maxScore || this.aiScore >= this.maxScore) {
      this.gameOver = true;
      const winner = this.playerScore >= this.maxScore ? 'PLAYER' : 'AI';
      this.ui.updateStatus(`${winner} WINS! Press SPACE to restart`);
      this.audio.playVictory(this.playerScore >= this.maxScore);
      return;
    }

    this.ui.updateStatus('Press SPACE to continue');
    this._resetBall();
  }

  // ─── Paddle Movement ──────────────────────────────────────────────

  _updatePlayerPaddle(dt) {
    const input = this.input.getAxis();
    const prevY = this.playerPaddle.position.y;
    const halfHeight = this.courtHeight / 2 - this.paddleHeight / 2;

    this.playerPaddle.position.y += input.y * this.paddleSpeed * dt;
    this.playerPaddle.position.y = Math.max(-halfHeight, Math.min(halfHeight, this.playerPaddle.position.y));

    this.playerPaddleVel = (this.playerPaddle.position.y - prevY) / dt;

    // Glow pulse
    const pulse = 2.5 + Math.sin(this.pulseTimer * 2) * 0.5;
    this.playerPaddle.material.emissiveIntensity = pulse;
  }

  _updateAiPaddle(dt) {
    const halfHeight = this.courtHeight / 2 - this.paddleHeight / 2;
    const prevY = this.aiPaddle.position.y;

    // AI only reacts when ball is moving toward it
    if (this.ballVx > 0 && this.serveTimer <= 0) {
      // Predict ball Y at AI paddle x
      let targetY = this.ball.position.y;

      // Simple prediction: where will ball be when it reaches AI x?
      const aiX = this.aiPaddle.position.x;
      const timeToReach = (aiX - this.ball.position.x) / this.ballVx;
      if (timeToReach > 0 && timeToReach < 2) {
        targetY = this.ball.position.y + this.ballVy * timeToReach;
        // Clamp to court
        targetY = Math.max(-this.courtHeight / 2, Math.min(this.courtHeight / 2, targetY));
      }

      // Add slight imperfection
      this.aiReactionTimer += dt;
      if (this.aiReactionTimer > 0.5) {
        this.aiReactionOffset = (Math.random() - 0.5) * 0.8;
        this.aiReactionTimer = 0;
      }

      targetY += this.aiReactionOffset;

      // Lerp toward target
      const diff = targetY - this.aiPaddle.position.y;
      this.aiPaddle.position.y += diff * this.aiLerpFactor * dt;
    } else {
      // Drift toward center when ball not approaching
      const diff = 0 - this.aiPaddle.position.y;
      this.aiPaddle.position.y += diff * 2 * dt;
    }

    this.aiPaddle.position.y = Math.max(-halfHeight, Math.min(halfHeight, this.aiPaddle.position.y));
    this.aiPaddleVel = (this.aiPaddle.position.y - prevY) / dt;

    // Glow pulse
    const pulse = 2.5 + Math.sin(this.pulseTimer * 2 + 1) * 0.5;
    this.aiPaddle.material.emissiveIntensity = pulse;
  }

  // ─── Game Loop ────────────────────────────────────────────────────

  _animate() {
    if (!this.running) return;
    requestAnimationFrame(() => this._animate());

    const now = performance.now();
    let rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamp dt to prevent spiral of death
    rawDt = Math.min(rawDt, 0.05);

    // Hit-stop timescale
    const dt = rawDt * this.hitStop.getTimescale();

    // Update pulse timer (always runs for visual effects)
    this.pulseTimer += rawDt;

    // Update game logic (only when not hit-stopped to zero)
    if (dt > 0.0001 && !this.gameOver) {
      this._updatePlayerPaddle(dt);
      this._updateAiPaddle(dt);
      this._updateBall(dt);
    }

    // Update VFX systems (always)
    this.particles.update(rawDt);
    this.shake.update(rawDt);
    this.trails.update(rawDt);
    this.shockwaves.update(rawDt);
    this.floatingText.update(rawDt);

    // Render
    this.renderer.render();
  }

  // ─── Cleanup ──────────────────────────────────────────────────────

  dispose() {
    this.running = false;

    // Dispose geometries
    if (this.ball) {
      this.ball.geometry.dispose();
      this.ball.material.dispose();
    }
    if (this.playerPaddle) {
      this.playerPaddle.geometry.dispose();
      this.playerPaddle.material.dispose();
    }
    if (this.aiPaddle) {
      this.aiPaddle.geometry.dispose();
      this.aiPaddle.material.dispose();
    }
    if (this.courtFloor) {
      this.courtFloor.geometry.dispose();
      if (this.courtFloor.material.map) this.courtFloor.material.map.dispose();
      this.courtFloor.material.dispose();
    }
    if (this.centerLine) {
      this.centerLine.geometry.dispose();
      this.centerLine.material.dispose();
    }
    if (this.wallLeft) {
      this.wallLeft.geometry.dispose();
      this.wallLeft.material.dispose();
    }
    if (this.wallRight) {
      this.wallRight.geometry.dispose();
      this.wallRight.material.dispose();
    }

    // Dispose shared systems
    this.particles.dispose();
    this.trails.dispose();
    this.shockwaves.dispose();
    this.floatingText.dispose();
    this.audio.dispose();
    this.ui.dispose();
    this.renderer.dispose();
  }
}
