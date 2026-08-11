import * as THREE from 'three';

const BALL_REST_SPEED = 5.0;
const BALL_MAX_SPEED = 14.0;
const BALL_RADIUS = 0.18;
const PADDLE_HIT_SPEED_MULT = 1.05;
const PADDLE_ANGLE_FACTOR = 1.8;
const WALL_BOUNDARY = 4.5;
const SCORE_BOUNDARY = 8.5;

export class PongBall {
  constructor(scene, ballLight, onPaddleHit, onScore) {
    this.scene = scene;
    this.ballLight = ballLight;
    this.onPaddleHit = onPaddleHit;
    this.onScore = onScore;

    this.velocity = new THREE.Vector3(0, 0, 0);
    this.active = false;

    const geometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 3.0,
      roughness: 0.1,
      metalness: 0.8,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // Dispose geometry since we only need one instance
    geometry.dispose();

    this.reset();
  }

  reset() {
    this.mesh.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.active = false;
  }

  serve(direction) {
    this.mesh.position.set(0, 0, 0);
    const angle = (Math.random() - 0.5) * 0.8;
    const speed = BALL_REST_SPEED;
    this.velocity.set(
      direction * speed * Math.cos(angle),
      speed * Math.sin(angle),
      0
    );
    this.active = true;
  }

  update(dt, leftPaddle, rightPaddle) {
    if (!this.active) return;

    // Move ball
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.y += this.velocity.y * dt;

    // Wall collision (top/bottom)
    if (this.mesh.position.y > WALL_BOUNDARY) {
      this.mesh.position.y = WALL_BOUNDARY;
      this.velocity.y = -Math.abs(this.velocity.y);
      this.onPaddleHit('wall', this.mesh.position.clone(), 0x00ffff);
    } else if (this.mesh.position.y < -WALL_BOUNDARY) {
      this.mesh.position.y = -WALL_BOUNDARY;
      this.velocity.y = Math.abs(this.velocity.y);
      this.onPaddleHit('wall', this.mesh.position.clone(), 0x00ffff);
    }

    // Paddle collision - left paddle
    if (this.velocity.x < 0 && this.checkPaddleCollision(leftPaddle)) {
      this.handlePaddleHit(leftPaddle, -1);
    }

    // Paddle collision - right paddle
    if (this.velocity.x > 0 && this.checkPaddleCollision(rightPaddle)) {
      this.handlePaddleHit(rightPaddle, 1);
    }

    // Score detection
    if (this.mesh.position.x < -SCORE_BOUNDARY) {
      this.onScore(2, this.mesh.position.clone());
      this.reset();
    } else if (this.mesh.position.x > SCORE_BOUNDARY) {
      this.onScore(1, this.mesh.position.clone());
      this.reset();
    }

    // Update ball light position
    this.ballLight.position.copy(this.mesh.position);
  }

  checkPaddleCollision(paddle) {
    const ballPos = this.mesh.position;
    const paddlePos = paddle.mesh.position;
    const paddleHalfW = 0.15;
    const paddleHalfH = 1.0;

    return (
      Math.abs(ballPos.x - paddlePos.x) < (BALL_RADIUS + paddleHalfW) &&
      Math.abs(ballPos.y - paddlePos.y) < (BALL_RADIUS + paddleHalfH)
    );
  }

  handlePaddleHit(paddle, direction) {
    const paddlePos = paddle.mesh.position;

    // Reverse and increase X velocity
    this.velocity.x = -this.velocity.x * PADDLE_HIT_SPEED_MULT;

    // Add angle based on hit offset
    const offset = this.mesh.position.y - paddlePos.y;
    this.velocity.y += offset * PADDLE_ANGLE_FACTOR;

    // Clamp speed
    const speed = Math.sqrt(
      this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
    );
    if (speed > BALL_MAX_SPEED) {
      const scale = BALL_MAX_SPEED / speed;
      this.velocity.x *= scale;
      this.velocity.y *= scale;
    }

    // Push ball out of paddle to prevent sticking
    this.mesh.position.x = paddlePos.x + direction * (BALL_RADIUS + 0.16);

    // Trigger VFX callback
    this.onPaddleHit(
      'paddle',
      this.mesh.position.clone(),
      paddle.color
    );
  }

  dispose() {
    this.mesh.material.dispose();
    this.scene.remove(this.mesh);
  }
}
