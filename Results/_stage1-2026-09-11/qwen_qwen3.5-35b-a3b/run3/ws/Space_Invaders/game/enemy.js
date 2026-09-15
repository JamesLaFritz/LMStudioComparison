import * as THREE from 'three';
import { Vector3, lerp } from '../../../shared/utils/math.js';
import { ObjectPool } from '../../../shared/utils/pool.js';

export class Enemy extends THREE.Mesh {
  constructor(type = 'grunt', position) {
    super();
    
    this.type = type;
    this.id = Math.random().toString(36).substr(2, 9);
    this.position.copy(position);
    this.velocity = new Vector3(0, 0, 0);
    this.health = this.getMaxHealth(type);
    this.maxHealth = this.health;
    this.alive = true;
    
    // Animation state
    this.animationFrame = 0;
    this.lastAnimationTime = Date.now();
    this.animationInterval = 250; // ms
    
    // Movement flags
    this.isMovingRight = true;
    this.descentCount = 0;
    this.maxDescents = 20;
    
    this._createMesh(type);
    this._setupMaterial(type);
    this.userData = { id: this.id, type: 'enemy', entity: this };
  }

  getMaxHealth(type) {
    switch (type) {
      case 'boss': return 50;
      case 'elite': return 10;
      case 'scout': return 5;
      default: return 3; // grunt
    }
  }

  _createMesh(type) {
    const geometry = this._generateProceduralGeometry(type);
    
    if (geometry) {
      this.geometry = geometry;
    } else {
      // Fallback to simple box
      this.geometry = new THREE.BoxGeometry(1, 0.5, 0.8);
    }
  }

  _generateProceduralGeometry(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Base shape based on type
    if (type === 'boss') {
      // Boss: large, menacing shape
      ctx.fillStyle = '#ff0088';
      ctx.fillRect(16, 8, 32, 24);
      ctx.fillRect(8, 16, 8, 8); // left wing
      ctx.fillRect(48, 16, 8, 8); // right wing
    } else if (type === 'elite') {
      // Elite: angular shape
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.moveTo(32, 4);
      ctx.lineTo(56, 16);
      ctx.lineTo(56, 28);
      ctx.lineTo(32, 24);
      ctx.lineTo(8, 28);
      ctx.lineTo(8, 16);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'scout') {
      // Scout: fast, sleek shape
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(24, 8, 16, 16);
      ctx.fillRect(20, 12, 4, 8); // left fin
      ctx.fillRect(40, 12, 4, 8); // right fin
    } else {
      // Grunt: classic invader shape
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(16, 8, 32, 16);
      ctx.fillRect(12, 12, 4, 8); // left arm
      ctx.fillRect(48, 12, 4, 8); // right arm
    }
    
    // Eyes (animated)
    const now = Date.now();
    const frameIndex = Math.floor(now / this.animationInterval) % 2;
    ctx.fillStyle = '#ffffff';
    if (frameIndex === 0) {
      ctx.fillRect(20, 12, 4, 4); // left eye open
      ctx.fillRect(40, 12, 4, 4); // right eye open
    } else {
      ctx.fillRect(20, 14, 4, 2); // left eye squint
      ctx.fillRect(40, 14, 4, 2); // right eye squint
    }
    
    // Antennae (pulse effect)
    const pulse = Math.sin(now * 0.01 + this.type.length) * 2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (type === 'boss') {
      ctx.moveTo(32, 8);
      ctx.lineTo(32, 8 - pulse * 1.5);
    } else {
      ctx.moveTo(24, 8);
      ctx.lineTo(24, 8 - pulse);
      ctx.moveTo(40, 8);
      ctx.lineTo(40, 8 - pulse);
    }
    ctx.stroke();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return new THREE.PlaneGeometry(1.2, 0.6).fromBufferAttribute(new Float32Array([
      -0.5, -0.3, 0, 0.5, -0.3, 0, 0.5, 0.3, 0,
      -0.5, -0.3, 0, 0.5, 0.3, 0, -0.5, 0.3, 0
    ]), 3);
  }

  _setupMaterial(type) {
    const emissiveColor = type === 'boss' ? '#ff0088' : 
                          type === 'elite' ? '#00ffff' : 
                          type === 'scout' ? '#ffaa00' : '#00ff00';
    
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: emissiveColor,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.7
    });
  }

  update(deltaTime, gameTime, isSwarmMode = false) {
    this.animationFrame++;
    
    if (isSwarmMode && this.alive) {
      // Swarm mode: track player with easing
      const targetX = this.targetPosition?.x || this.position.x;
      this.position.x = lerp(this.position.x, targetX, 0.05);
    }
    
    return this.alive;
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
    return !this.alive;
  }

  getHealthPercent() {
    return this.health / this.maxHealth;
  }

  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
  }
}

export const EnemyPool = new ObjectPool(Enemy, 55);