import * as THREE from 'three';
import { Entity } from './entity.js';
import { Vector3, lerp, clamp } from '../../../shared/utils/math.js';
import { InputController } from '../../../shared/input/controller.js';

export class Player extends Entity {
  constructor(position) {
    super(position);
    
    // Movement properties
    this.speed = 8.0;
    this.maxSpeed = 12.0;
    this.friction = 0.92;
    this.acceleration = 0.5;
    
    // Combat properties
    this.health = 3;
    this.shieldActive = false;
    this.powerUpType = null;
    this.powerUpTimer = 0;
    this.fireRate = 15; // frames between shots
    this.fireCooldown = 0;
    
    // Visual properties
    this.mesh = this.createMesh();
    this.shieldMesh = null;
    this.powerUpRing = null;
    
    // Animation state
    this.animationFrame = 0;
    this.animationTimer = 0;
    
    // Initialize position
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.width = 1.2;
    this.height = 0.6;
  }

  createMesh() {
    const geometry = new THREE.BufferGeometry();
    
    // Procedural spaceship shape via canvas
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Main body (futuristic fighter)
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(32, 0); // nose
    ctx.lineTo(56, 16); // right wing tip
    ctx.lineTo(48, 16); // right engine
    ctx.lineTo(48, 24); // right engine base
    ctx.lineTo(16, 24); // left engine base
    ctx.lineTo(16, 16); // left engine
    ctx.lineTo(8, 16); // left wing tip
    ctx.closePath();
    ctx.fill();
    
    // Cockpit
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(32, 10, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Engine glow (animated)
    const pulse = Math.sin(Date.now() * 0.05) * 2;
    ctx.fillStyle = `rgba(255, ${100 + pulse}, 0, 1)`;
    ctx.beginPath();
    ctx.moveTo(20, 24);
    ctx.lineTo(28, 32 - pulse);
    ctx.lineTo(36, 24);
    ctx.closePath();
    ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: 0x0044aa,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.3
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(this.position);
    mesh.userData = { id: this.id, type: 'player' };
    
    return mesh;
  }

  createShield() {
    if (this.shieldMesh) return;
    
    const geometry = new THREE.RingGeometry(0.8, 1.0, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    this.shieldMesh = new THREE.Mesh(geometry, material);
    this.shieldMesh.position.copy(this.position);
    this.shieldMesh.rotation.x = Math.PI / 2;
    this.shieldMesh.userData = { id: this.id + '_shield', type: 'shield' };
    
    return this.shieldMesh;
  }

  createPowerUpRing(type) {
    if (this.powerUpRing) return;
    
    const colors = {
      spread: 0xff00ff,
      shield: 0x00ffff,
      rapid: 0xffff00
    };
    
    const geometry = new THREE.RingGeometry(1.2, 1.4, 32);
    const material = new THREE.MeshBasicMaterial({
      color: colors[type],
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    this.powerUpRing = new THREE.Mesh(geometry, material);
    this.powerUpRing.position.copy(this.position);
    this.powerUpRing.rotation.x = Math.PI / 2;
    this.powerUpRing.userData = { id: this.id + '_ring', type: 'powerup_ring' };
    
    return this.powerUpRing;
  }

  update(deltaTime, input) {
    // Handle shield activation
    if (this.shieldActive && !input.isActionPressed('shield')) {
      this.deactivateShield();
    }
    
    // Apply power-up timer
    if (this.powerUpTimer > 0) {
      this.powerUpTimer -= deltaTime;
      if (this.powerUpTimer <= 0) {
        this.clearPowerUps();
      }
    }
    
    // Movement physics
    const targetSpeed = input.isActionPressed('left') ? -1 : 
                       input.isActionPressed('right') ? 1 : 0;
    
    if (targetSpeed !== 0) {
      this.velocity.x += targetSpeed * this.acceleration;
    } else {
      this.velocity.x *= this.friction;
    }
    
    // Clamp speed
    this.velocity.x = clamp(this.velocity.x, -this.maxSpeed, this.maxSpeed);
    
    // Update position
    this.position.x += this.velocity.x * deltaTime;
    
    // Boundary constraints
    const leftBoundary = -5.0;
    const rightBoundary = 5.0;
    if (this.position.x < leftBoundary + this.width/2) {
      this.position.x = leftBoundary + this.width/2;
      this.velocity.x = 0;
    }
    if (this.position.x > rightBoundary - this.width/2) {
      this.position.x = rightBoundary - this.width/2;
      this.velocity.x = 0;
    }
    
    // Update mesh position
    this.mesh.position.copy(this.position);
    
    // Update shield mesh
    if (this.shieldMesh) {
      this.shieldMesh.position.copy(this.position);
      this.shieldMesh.rotation.z += deltaTime * 2; // rotate shield
    }
    
    // Update power-up ring
    if (this.powerUpRing) {
      this.powerUpRing.position.copy(this.position);
      this.powerUpRing.rotation.z += deltaTime * 3;
    }
    
    // Animation update
    this.animationTimer += deltaTime;
    if (this.animationTimer > 0.15) {
      this.animationFrame = (this.animationFrame + 1) % 4;
      this.animationTimer = 0;
    }
    
    // Fire cooldown
    if (this.fireCooldown > 0) {
      this.fireCooldown -= deltaTime * 60;
    }
  }

  shoot() {
    if (this.fireCooldown > 0 || !this.mesh.parent) return null;
    
    const bullet = new Bullet(
      new Vector3(this.position.x, this.position.y + 0.4, this.position.z),
      'player'
    );
    
    // Apply power-up effects to bullet
    if (this.powerUpType === 'spread') {
      bullet.angleOffset = -0.15;
    } else if (this.powerUpType === 'rapid') {
      this.fireCooldown = 8; // faster fire rate
    } else {
      this.fireCooldown = this.fireRate;
    }
    
    return bullet;
  }

  activateShield() {
    if (!this.shieldActive) {
      this.shieldActive = true;
      const shieldMesh = this.createShield();
      if (shieldMesh && shieldMesh.parent === null) {
        this.mesh.parent.add(shieldMesh);
      }
    }
  }

  deactivateShield() {
    this.shieldActive = false;
    if (this.shieldMesh) {
      this.mesh.parent.remove(this.shieldMesh);
      this.shieldMesh.geometry.dispose();
      this.shieldMesh.material.dispose();
      this.shieldMesh = null;
    }
  }

  applyPowerUp(type, duration = 10) {
    this.powerUpType = type;
    this.powerUpTimer = duration;
    
    const ring = this.createPowerUpRing(type);
    if (ring && ring.parent === null) {
      this.mesh.parent.add(ring);
    }
    
    // Special effects for each power-up
    switch (type) {
      case 'spread':
        this.fireRate = 12;
        break;
      case 'rapid':
        this.fireRate = 8;
        break;
      case 'shield':
        this.activateShield();
        break;
    }
  }

  clearPowerUps() {
    if (this.powerUpType === 'spread') {
      this.fireRate = 15;
    } else if (this.powerUpType === 'rapid') {
      this.fireRate = 15;
    }
    
    this.powerUpType = null;
    this.powerUpTimer = 0;
    
    if (this.powerUpRing) {
      this.mesh.parent.remove(this.powerUpRing);
      this.powerUpRing.geometry.dispose();
      this.powerUpRing.material.dispose();
      this.powerUpRing = null;
    }
  }

  takeDamage() {
    if (this.shieldActive) {
      this.deactivateShield();
      return false; // shield absorbed damage
    }
    
    this.health--;
    return true; // actual damage taken
  }

  isAlive() {
    return this.health > 0 && this.mesh.parent !== null;
  }

  dispose() {
    if (this.shieldMesh) {
      this.mesh.parent.remove(this.shieldMesh);
      this.shieldMesh.geometry.dispose();
      this.shieldMesh.material.dispose();
    }
    
    if (this.powerUpRing) {
      this.mesh.parent.remove(this.powerUpRing);
      this.powerUpRing.geometry.dispose();
      this.powerUpRing.material.dispose();
    }
    
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// Bullet class for player projectiles
export class Bullet extends Entity {
  constructor(position, owner) {
    super(position);
    
    this.owner = owner; // 'player' or 'alien'
    this.damage = 1;
    this.lifetime = 60; // frames
    this.angleOffset = 0;
    
    const geometry = new THREE.BufferGeometry();
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    
    if (owner === 'player') {
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(4, 2, 24, 4);
    } else {
      ctx.fillStyle = '#ff0088';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(28, 4);
      ctx.lineTo(16, 8);
      ctx.lineTo(4, 4);
      ctx.closePath();
      ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    this.mesh.userData = { id: this.id, type: 'bullet', owner };
    
    // Set velocity based on owner
    if (owner === 'player') {
      this.velocity.set(0, 8.0 + Math.random() * 2, 0);
    } else {
      const dirX = position.x < 0 ? -1 : 1;
      this.velocity.set(dirX * (1.5 + Math.random() * 1), -(4.0 + Math.random() * 2), 0);
    }
    
    this.width = owner === 'player' ? 0.3 : 0.4;
    this.height = owner === 'player' ? 0.1 : 0.25;
  }

  update(deltaTime) {
    this.position.addScaledVector(this.velocity, deltaTime);
    this.mesh.position.copy(this.position);
    
    // Lifetime countdown
    this.lifetime -= deltaTime * 60;
    
    if (this.lifetime <= 0) {
      return false; // expired
    }
    
    return true; // still active
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}