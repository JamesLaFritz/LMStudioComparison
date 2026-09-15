import { MeshStandardMaterial, BoxGeometry, Vector3 } from 'three';
import * as utils from '../shared/utils/math.js';
import { InputManager } from '../shared/utils/input.js';

/**
 * Player controller for Space Invaders.
 * Handles movement, shooting, and state management.
 */
export class Player {
  constructor(scene, position = new Vector3(0, -12, 0), width = 4, height = 5) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.position = new Vector3();
    this.velocity = new Vector3();
    this.speed = 500; // pixels per second
    this.fireRate = 12; // shots per second
    this.lastFireTime = 0;
    this.isDead = false;

    // Create player mesh
    const geometry = new BoxGeometry(width, height, 0.3);
    const material = new MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x0044ff,
      emissiveIntensity: 0.6,
      metalness: 0.2,
      roughness: 0.5,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);

    // Trail buffer for motion trails
    this.trailPositions = [];
    this.maxTrailLength = 12;
    this.trailColor = new THREE.Color(0x00ffff);
    this.trailGeometry = null;
    this.trailMaterial = null;
    this._createTrail();

    // Input reference (set by game)
    this.inputManager = null;
  }

  /**
   * Set the input manager for this player.
   */
  setInputManager(inputManager) {
    this.inputManager = inputManager;
  }

  /**
   * Update player position and state based on input.
   * @param {number} dt - Delta time in seconds
   */
  update(dt, boundsXMin, boundsXMax) {
    if (this.isDead) return;

    // Handle movement from input
    const moveInput = this.inputManager ? this.inputManager.getKeyState('moveLeft') : false;
    const moveRightInput = this.inputManager ? this.inputManager.getKeyState('moveRight') : false;

    let vx = 0;
    if (moveInput) {
      vx -= 1;
    }
    if (moveRightInput) {
      vx += 1;
    }

    // Apply velocity and clamp to bounds
    this.velocity.x = vx * this.speed * dt;
    this.position.x += this.velocity.x;

    // Clamp position within bounds
    this.position.x = utils.clamp(this.position.x, boundsXMin - this.width / 2, boundsXMax - this.width / 2);

    // Update mesh position
    this.mesh.position.copy(this.position);

    // Update trail buffer
    this._updateTrail();
  }

  /**
   * Attempt to fire a projectile. Returns true if a shot was fired.
   * @param {number} dt - Delta time in seconds
   */
  canFire(dt) {
    const now = performance.now() / 1000;
    return (now - this.lastFireTime) >= (1 / this.fireRate);
  }

  /**
   * Fire a projectile. Returns the projectile object or null if not allowed.
   */
  fire(projectileFactory, dt) {
    const now = performance.now() / 1000;
    if (!this.canFire(dt)) return null;

    this.lastFireTime = now;

    // Create projectile at player's position
    const projectile = projectileFactory(this.position);
    return projectile;
  }

  /**
   * Mark the player as dead.
   */
  die() {
    this.isDead = true;
  }

  /**
   * Reset player to alive state.
   */
  revive() {
    this.isDead = false;
  }

  /**
   * Create a motion trail mesh for the player.
   */
  _createTrail() {
    const points = [];
    for (let i = 0; i < this.maxTrailLength; i++) {
      points.push(new Vector3(0, -this.height / 2 + i * (this.height / this.maxTrailLength), 0));
    }

    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setPoints(points);
    this.trailMaterial = new MeshStandardMaterial({
      color: this.trailColor,
      emissive: this.trailColor,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.6,
      size: 2,
      wireframe: false,
    });

    // Create a line mesh from the trail geometry (using Points)
    this.trailMesh = new THREE.LineSegments(
      this.trailGeometry,
      this.trailMaterial
    );
    this.scene.add(this.trailMesh);
  }

  /**
   * Update the trail buffer with current position.
   */
  _updateTrail() {
    const points = [];
    for (let i = 0; i < this.maxTrailLength; i++) {
      // Interpolate from bottom of player to current position
      const t = i / this.maxTrailLength;
      const y = -this.height / 2 + t * (this.position.y - (-this.height / 2));
      points.push(new Vector3(this.position.x, y, 0));
    }

    if (this.trailGeometry) {
      this.trailGeometry.setPoints(points);
    }
  }

  /**
   * Dispose of all Three.js resources.
   */
  dispose() {
    if (this.mesh) {
      this.mesh.dispose();
    }
    if (this.trailMesh) {
      this.trailMesh.dispose();
    }
    if (this.trailGeometry) {
      this.trailGeometry.dispose();
    }
    if (this.trailMaterial) {
      this.trailMaterial.dispose();
    }
  }

  /**
   * Get the player's position.
   */
  getPosition() {
    return new Vector3(this.position);
  }

  /**
   * Get the player's bounding box for collision detection.
   */
  getBounds() {
    return {
      x: this.position.x - this.width / 2,
      y: this.position.y - this.height / 2,
      z: this.position.z - 0.15,
      w: this.width,
      h: this.height,
      d: 0.3,
    };
  }
}