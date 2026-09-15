import * as THREE from 'three';
import { MaterialFactory } from '../../shared/rendering/MaterialFactory.js';
import Vec3Util from '../../shared/math/Vec3Util.js';

const PLAYER_SPEED = 12.0;
const PLAYER_WIDTH = 1.8;
const PLAYER_HEIGHT = 0.6;
const PLAYER_DEPTH = 1.0;
const PLAYER_MIN_X = -14.0;
const PLAYER_MAX_X = 14.0;

export class PlayerShip {
  constructor(scene) {
    this.scene = scene;
    this.alive = true;
    this.respawnTimer = 0;
    this.respawnDuration = 2.0;
    this.invincibleTimer = 0;
    this.invincibleDuration = 1.5;
    this.blinkInterval = 0.1;
    this.blinkTimer = 0;
    this.visibleState = true;

    this.position = new THREE.Vector3(0, -6.5, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.buildMesh();
    this.light = new THREE.PointLight(0x00ffff, 2.0, 8.0);
    this.light.position.set(0, 0.5, 1.0);
    this.mesh.add(this.light);
    scene.add(this.mesh);
  }

  buildMesh() {
    const group = new THREE.Group();

    // Main body — sleek wedge shape
    const bodyGeo = new THREE.ConeGeometry(0.5, 1.4, 4);
    bodyGeo.rotateY(Math.PI / 4);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = MaterialFactory.createPBR({
      color: 0x00ccff,
      emissive: 0x003355,
      metalness: 0.7,
      roughness: 0.2,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(this.bodyMesh);

    // Left wing
    const wingGeo = new THREE.BoxGeometry(1.2, 0.15, 0.6);
    const wingMat = MaterialFactory.createPBR({
      color: 0x0099cc,
      emissive: 0x002244,
      metalness: 0.6,
      roughness: 0.3,
    });
    this.leftWing = new THREE.Mesh(wingGeo, wingMat);
    this.leftWing.position.set(-0.8, -0.15, 0.2);
    group.add(this.leftWing);

    // Right wing
    this.rightWing = new THREE.Mesh(wingGeo, wingMat.clone());
    this.rightWing.position.set(0.8, -0.15, 0.2);
    group.add(this.rightWing);

    // Cockpit glow
    const cockpitGeo = new THREE.SphereGeometry(0.2, 8, 6);
    const cockpitMat = MaterialFactory.createPBR({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 1.5,
      metalness: 0.0,
      roughness: 0.0,
    });
    this.cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    this.cockpit.position.set(0, 0.1, 0.4);
    group.add(this.cockpit);

    // Engine glow particles (small emissive spheres)
    const engineGeo = new THREE.SphereGeometry(0.1, 6, 4);
    const engineMat = MaterialFactory.createPBR({
      color: 0xff6600,
      emissive: 0xff4400,
      emissiveIntensity: 2.0,
      metalness: 0.0,
      roughness: 0.0,
    });
    this.leftEngine = new THREE.Mesh(engineGeo, engineMat);
    this.leftEngine.position.set(-0.5, -0.1, -0.6);
    group.add(this.leftEngine);

    this.rightEngine = new THREE.Mesh(engineGeo, engineMat.clone());
    this.rightEngine.position.set(0.5, -0.1, -0.6);
    group.add(this.rightEngine);

    this.mesh = group;
    this.mesh.position.copy(this.position);
  }

  update(dt, input) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    // Invincibility blinking
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      this.blinkTimer += dt;
      if (this.blinkTimer >= this.blinkInterval) {
        this.blinkTimer = 0;
        this.visibleState = !this.visibleState;
        this.mesh.visible = this.visibleState;
      }
    }

    // Horizontal movement
    let moveX = 0;
    if (input.left) moveX -= 1.0;
    if (input.right) moveX += 1.0;

    this.velocity.x = moveX * PLAYER_SPEED;
    this.position.x += this.velocity.x * dt;
    this.position.x = Math.max(PLAYER_MIN_X, Math.min(PLAYER_MAX_X, this.position.x));

    // Subtle vertical hover
    const time = performance.now() * 0.001;
    this.position.y = -6.5 + Math.sin(time * 2.0) * 0.08;

    this.mesh.position.copy(this.position);

    // Tilt based on movement
    const targetTilt = -moveX * 0.3;
    this.mesh.rotation.z += (targetTilt - this.mesh.rotation.z) * dt * 5.0;

    // Engine flicker
    const flicker = 0.8 + Math.sin(time * 20.0) * 0.2;
    this.leftEngine.scale.setScalar(flicker);
    this.rightEngine.scale.setScalar(flicker);
  }

  shoot() {
    if (!this.alive) return null;
    const proj = {
      position: new THREE.Vector3(this.position.x, this.position.y + 0.5, this.position.z),
      velocity: new THREE.Vector3(0, 18.0, 0),
      isPlayer: true,
      damage: 1,
    };
    return proj;
  }

  getAABB() {
    const hw = PLAYER_WIDTH / 2;
    const hh = PLAYER_HEIGHT / 2;
    return {
      minX: this.position.x - hw,
      maxX: this.position.x + hw,
      minY: this.position.y - hh,
      maxY: this.position.y + hh,
      minZ: this.position.z - PLAYER_DEPTH / 2,
      maxZ: this.position.z + PLAYER_DEPTH / 2,
    };
  }

  hit() {
    if (this.invincibleTimer > 0 || !this.alive) return false;
    this.alive = false;
    this.respawnTimer = this.respawnDuration;
    this.mesh.visible = false;
    return true;
  }

  respawn() {
    this.alive = true;
    this.position.set(0, -6.5, 0);
    this.mesh.position.copy(this.position);
    this.invincibleTimer = this.invincibleDuration;
    this.blinkTimer = 0;
    this.visibleState = true;
    this.mesh.visible = true;
    this.mesh.rotation.z = 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.light.dispose();
  }
}
