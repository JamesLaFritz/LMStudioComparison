import { createAlienMesh } from '../rendering/alienMesh.js';
import { ALIEN_CONSTANTS, NEON_COLORS } from '../../shared/constants.js';

/**
 * Individual Alien Entity
 * Represents a single alien in the grid with type-specific properties
 */
export class IndividualAlien {
  /**
   * @param {string} type - 'squid', 'crab', or 'octopus'
   * @param {number} x - Initial X position
   * @param {number} y - Initial Y position
   * @param {THREE.Scene} scene - Three.js scene reference
   * @param {Object} vfxSystems - VFX system references
   * @param {AudioSynth} audioSynth - Audio synthesizer for SFX
   */
  constructor(type, x, y, scene, vfxSystems, audioSynth) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.scene = scene;
    this.vfxSystems = vfxSystems;
    this.audioSynth = audioSynth;
    
    // Type-specific properties
    const typeConfig = ALIEN_CONSTANTS.types[type];
    this.points = typeConfig.points;
    this.fireChance = typeConfig.fireChance;
    this.speedModifier = typeConfig.speedModifier;
    
    // Dimensions
    this.width = 2.5;
    this.height = 1.8;
    
    // Animation state
    this.animationFrame = 0;
    this.animationTimer = 0;
    this.squashStretch = { x: 1, y: 1 };
    
    // State
    this.alive = true;
    this.shouldFire = false;
    
    // Cached values for rendering
    this.emissiveColor = typeConfig.color;
    
    // Create mesh
    const meshData = createAlienMesh(type);
    this.mesh = meshData.mesh;
    this.texture = meshData.texture;
    this.mesh.position.set(x, y, 0);
    scene.add(this.mesh);
  }

  /**
   * Update alien state per frame
   * @param {number} dt - Delta time in seconds
   * @param {number} direction - Current grid movement direction (1 or -1)
   * @returns {boolean} Whether the alien should fire a bomb
   */
  update(dt, direction) {
    if (!this.alive) return false;

    // Animation timer for squash/stretch effect
    this.animationTimer += dt * ALIEN_CONSTANTS.ANIMATION_SPEED;

    // Determine animation frame based on timer
    const newFrame = Math.floor(this.animationTimer) % 2;
    if (newFrame !== this.animationFrame) {
      this.animationFrame = newFrame;
      this.triggerAnimationEffect(direction);
    }

    // Random fire decision
    this.shouldFire = Math.random() < this.fireChance * dt * 60;

    return this.shouldFire;
  }

  /**
   * Trigger squash/stretch animation effect based on movement direction
   */
  triggerSquash() {
    this.squashStretch.x = 1.2;
    this.squashStretch.y = 0.8;
    
    // Apply to mesh with lerp in update
    if (this.mesh) {
      const currentScaleX = this.mesh.scale.x;
      const currentScaleY = this.mesh.scale.y;
      
      this.mesh.scale.x = THREE.MathUtils.lerp(currentScaleX, 1.2, 0.5);
      this.mesh.scale.y = THREE.MathUtils.lerp(currentScaleY, 0.8, 0.5);
    }
  }

  /**
   * Trigger animation effect based on movement direction
   */
  triggerAnimationEffect(direction) {
    const isFrame0 = this.animationFrame === 0;

    // Squash on frame 0, stretch on frame 1
    if (isFrame0) {
      this.squashStretch.x = 1.15;
      this.squashStretch.y = 0.85;
    } else {
      this.squashStretch.x = 0.85;
      this.squashStretch.y = 1.15;
    }

    // Apply to mesh with smooth interpolation
    if (this.mesh) {
      const currentScaleX = this.mesh.scale.x || 1;
      const currentScaleY = this.mesh.scale.y || 1;

      this.mesh.scale.x = THREE.MathUtils.lerp(currentScaleX, this.squashStretch.x, 0.3);
      this.mesh.scale.y = THREE.MathUtils.lerp(currentScaleY, this.squashStretch.y, 0.3);
    }
  }

  /**
   * Mark alien as dead and trigger destruction effects
   * @param {THREE.Vector3} hitPosition - Position where the projectile hit
   */
  destroy(hitPosition) {
    if (!this.alive) return;

    this.alive = false;

    // Trigger VFX at hit position or alien position
    const pos = hitPosition || new THREE.Vector3(this.x, this.y, 0);

    // Spawn particle explosion
    if (this.vfxSystems?.particles) {
      this.vfxSystems.particles.spawnExplosion(pos, 15, this.emissiveColor);
    }

    // Spawn shockwave
    if (this.vfxSystems?.shockwaves) {
      this.vfxSystems.shockwaves.spawn(pos, 2, 0.25);
    }

    // Play sound
    if (this.audioSynth) {
      this.audioSynth.playExplosion('small');
    }

    // Hide mesh immediately (particles take over visual feedback)
    this.mesh.visible = false;
  }

  /**
   * Get the alien's bounding box for collision detection
   */
  getBoundingBox() {
    return {
      minX: this.x - this.width / 2,
      maxX: this.x + this.width / 2,
      minY: this.y - this.height / 2,
      maxY: this.y + this.height / 2
    };
  }

  /**
   * Check if projectile is colliding with this alien
   */
  checkCollision(projectile) {
    if (!this.alive) return false;

    const projX = projectile.mesh.position.x;
    const projY = projectile.mesh.position.y;
    const projRadius = 0.3;

    // Simple circle-AABB collision
    const closestX = Math.max(this.x - this.width / 2, Math.min(projX, this.x + this.width / 2));
    const closestY = Math.max(this.y - this.height / 2, Math.min(projY, this.y + this.height / 2));

    const dx = projX - closestX;
    const dy = projY - closestY;

    return (dx * dx + dy * dy) <= (projRadius * projRadius);
  }

  /**
   * Dispose of alien resources
   */
  dispose() {
    if (this.scene && this.mesh) {
      this.scene.remove(this.mesh);
    }

    if (this.texture) {
      this.texture.dispose();
      this.texture.image = null;
    }

    if (this.mesh?.material) {
      this.mesh.material.dispose();
    }

    if (this.mesh?.geometry) {
      this.mesh.geometry.dispose();
    }
  }
}

/**
 * Alien Type Configuration Helper
 */
export function getAlienTypeConfig(type) {
  return ALIEN_CONSTANTS.types[type] || ALIEN_CONSTANTS.types.octopus;
}

/**
 * Determine alien type based on row number
 */
export function getAlienTypeForRow(row) {
  if (row <= 1) return 'squid';
  if (row <= 3) return 'crab';
  return 'octopus';
}

export default IndividualAlien;
