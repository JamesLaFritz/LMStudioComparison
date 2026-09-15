import { createUFOGeometry } from '../rendering/alienMesh.js';
import { NEON_COLORS, UFO_CONSTANTS } from '../../shared/constants.js';

/**
 * UFO Boss Entity - Rare high-value target that traverses the screen
 */
export class UFOBoss {
  constructor(scene, vfxSystems, audioSynth) {
    this.scene = scene;
    this.vfxSystems = vfxSystems;
    this.audioSynth = audioSynth;
    
    // Geometry and material (created once, reused via visibility toggle)
    const geometry = createUFOGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: 0x220033,
      emissive: NEON_COLORS.UFO_GLOW,
      emissiveIntensity: 1.5,
      metalness: 0.6,
      roughness: 0.2
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false;
    scene.add(this.mesh);
    
    // State
    this.active = false;
    this.position = { x: -30, y: UFO_CONSTANTS.Y_POSITION };
    this.speed = UFO_CONSTANTS.TRANSIT_SPEED;
    this.direction = 1;
    this.spawnTimer = 0;
    this.nextSpawnMin = UFO_CONSTANTS.MIN_SPAWN_INTERVAL;
    this.nextSpawnMax = UFO_CONSTANTS.MAX_SPAWN_INTERVAL;
    
    // Value (randomized per spawn)
    this.points = Math.floor(Math.random() * 150) + 150; // 150-300 points
    
    // Power-up drop chance
    this.dropPowerUpChance = UFO_CONSTANTS.POWERUP_DROP_CHANCE;
  }
  
  update(dt, gameWidth) {
    if (!this.active) {
      this.updateSpawnTimer(dt);
      return null; // No power-up dropped
    }
    
    // Move across screen
    this.position.x += this.speed * this.direction * dt * 60;
    
    // Update mesh position
    this.mesh.position.set(this.position.x, this.position.y, 0);
    
    // Check if reached edge
    const halfWidth = gameWidth / 2;
    if (this.position.x > halfWidth || this.position.x < -halfWidth) {
      this.deactivate();
      return null;
    }
    
    return null;
  }
  
  updateSpawnTimer(dt) {
    this.spawnTimer += dt * 1000; // Convert to milliseconds
    
    if (this.spawnTimer >= this.nextSpawnMin) {
      // Random chance to spawn each check
      if (Math.random() < 0.3) {
        this.spawn();
        return;
      }
    }
    
    // Reset timer occasionally
    if (this.spawnTimer > this.nextSpawnMax * 1.5) {
      this.spawnTimer = 0;
      this.nextSpawnMin = UFO_CONSTANTS.MIN_SPAWN_INTERVAL + Math.random() * 2000;
      this.nextSpawnMax = UFO_CONSTANTS.MAX_SPAWN_INTERVAL + Math.random() * 3000;
    }
  }
  
  spawn() {
    // Randomize direction and entry point
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.position.x = this.direction === 1 ? -40 : 40;
    
    // Reset timer for next potential spawn
    this.spawnTimer = 0;
    this.nextSpawnMin = UFO_CONSTANTS.MIN_SPAWN_INTERVAL + Math.random() * 2000;
    this.nextSpawnMax = UFO_CONSTANTS.MAX_SPAWN_INTERVAL + Math.random() * 3000;
    
    // Randomize points for this spawn
    this.points = Math.floor(Math.random() * 150) + 150;
    
    this.active = true;
    this.mesh.visible = true;
    this.mesh.position.set(this.position.x, this.position.y, 0);
  }
  
  deactivate() {
    this.active = false;
    this.mesh.visible = false;
  }
  
  destroy(onPoints, onVFX, onAudio) {
    if (!this.active) return null;
    
    this.deactivate();
    
    // Award points
    onPoints(this.points);
    
    // Trigger VFX
    const pos = new THREE.Vector3(this.position.x, this.position.y, 0);
    onVFX(pos);
    
    // Play sound
    onAudio('ufoDestroy');
    
    // Check for power-up drop
    if (Math.random() < this.dropPowerUpChance) {
      return this.generatePowerUp();
    }
    
    return null;
  }
  
  generatePowerUp() {
    const types = ['spread', 'shield', 'rapidfire'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    return {
      type: type,
      x: this.position.x,
      y: this.position.y
    };
  }
  
  getBounds() {
    if (!this.active) return null;
    
    const halfWidth = UFO_CONSTANTS.WIDTH / 2;
    const halfHeight = UFO_CONSTANTS.HEIGHT / 2;
    
    return {
      left: this.position.x - halfWidth,
      right: this.position.x + halfWidth,
      top: this.position.y + halfHeight,
      bottom: this.position.y - halfHeight
    };
  }
  
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.scene.remove(this.mesh);
  }
}

// Make THREE available globally for the class (Vite handles this)
if (typeof THREE === 'undefined') {
  globalThis.THREE = await import('three');
}
