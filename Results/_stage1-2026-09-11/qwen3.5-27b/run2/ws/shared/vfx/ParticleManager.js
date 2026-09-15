import { ObjectPool } from '../core/ObjectPool.js';
import { Particle } from './Particle.js';

/**
 * Centralized particle system with 500-particle hard cap.
 * Uses priority queue to manage overflow by removing lowest-priority particles first.
 */
export class ParticleManager {
    constructor(scene, maxParticles = 500) {
        this.scene = scene;
        this.maxParticles = maxParticles;
        
        // Priority levels (higher number = higher priority)
        this.PRIORITY = {
            CRITICAL: 4,   // Explosions from important events
            HIGH: 3,       // Player-related effects
            MEDIUM: 2,     // Standard explosions
            LOW: 1         // Ambient particles, trails
        };
        
        // Create particle pool
        this.pool = new ObjectPool(() => new Particle(), maxParticles);
        this.activeParticles = [];
        
        // Track total spawned for debugging
        this.totalSpawned = 0;
    }

    /**
     * Spawn a burst of particles at a position.
     * @param {THREE.Vector3} position - World space spawn location
     * @param {number} count - Number of particles to spawn
     * @param {string} type - Particle type: 'explosion', 'spark', 'smoke', 'trail'
     * @param {object} options - Additional configuration
     * @returns {Particle[]} Array of spawned particles
     */
    spawnBurst(position, count = 10, type = 'explosion', options = {}) {
        const priority = this.getPriorityForType(type);
        
        // Ensure we don't exceed hard cap by removing low-priority particles first
        while (this.activeParticles.length + count > this.maxParticles) {
            if (!this.removeLowestPriority()) break;
        }
        
        const spawned = [];
        for (let i = 0; i < count; i++) {
            // Check again before each spawn in case we hit the cap
            if (this.activeParticles.length >= this.maxParticles) break;
            
            const particle = this.pool.acquire();
            particle.init(position, type, options);
            particle.priority = priority;
            
            this.scene.add(particle.mesh);
            this.activeParticles.push(particle);
            spawned.push(particle);
            this.totalSpawned++;
        }
        
        return spawned;
    }

    /**
     * Spawn a single continuous particle (e.g., trail, engine exhaust)
     */
    spawnContinuous(position, type = 'trail', options = {}) {
        if (this.activeParticles.length >= this.maxParticles) {
            this.removeLowestPriority();
        }
        
        const particle = this.pool.acquire();
        particle.init(position, type, options);
        particle.isContinuous = true;
        particle.priority = this.getPriorityForType(type);
        
        this.scene.add(particle.mesh);
        this.activeParticles.push(particle);
        
        return particle;
    }

    /**
     * Get priority level for a particle type.
     */
    getPriorityForType(type) {
        switch (type) {
            case 'explosion': return this.PRIORITY.CRITICAL;
            case 'player_hit': return this.PRIORITY.HIGH;
            case 'powerup': return this.PRIORITY.HIGH;
            case 'spark': return this.PRIORITY.MEDIUM;
            case 'smoke': return this.PRIORITY.LOW;
            case 'trail': return this.PRIORITY.LOW;
            default: return this.PRIORITY.MEDIUM;
        }
    }

    /**
     * Remove the lowest priority active particle.
     * @returns {boolean} True if a particle was removed, false otherwise
     */
    removeLowestPriority() {
        if (this.activeParticles.length === 0) return false;
        
        // Find the particle with lowest priority and oldest age
        let targetIndex = -1;
        let lowestPriority = Infinity;
        let oldestTime = -Infinity;
        
        for (let i = 0; i < this.activeParticles.length; i++) {
            const p = this.activeParticles[i];
            
            // Prioritize by priority level first, then by age (older = remove first)
            if (p.priority < lowestPriority || 
                (p.priority === lowestPriority && p.age > oldestTime)) {
                targetIndex = i;
                lowestPriority = p.priority;
                oldestTime = p.age;
            }
        }
        
        if (targetIndex >= 0) {
            this.releaseParticle(this.activeParticles[targetIndex]);
            return true;
        }
        
        return false;
    }

    /**
     * Release a particle back to the pool.
     */
    releaseParticle(particle) {
        const index = this.activeParticles.indexOf(particle);
        if (index >= 0) {
            this.activeParticles.splice(index, 1);
            
            // Remove from scene
            if (particle.mesh && this.scene.children.includes(particle.mesh)) {
                this.scene.remove(particle.mesh);
            }
            
            // Return to pool
            this.pool.release(particle);
        }
    }

    /**
     * Update all active particles.
     * @param {number} delta - Time since last frame in seconds
     */
    update(delta) {
        // Filter out dead particles and update living ones
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const particle = this.activeParticles[i];
            
            if (!particle.update(delta)) {
                // Particle is dead, release it
                this.releaseParticle(particle);
            }
        }
    }

    /**
     * Clear all particles immediately.
     */
    clearAll() {
        for (const particle of this.activeParticles) {
            if (particle.mesh && this.scene.children.includes(particle.mesh)) {
                this.scene.remove(particle.mesh);
            }
        }
        
        // Release all back to pool
        while (this.activeParticles.length > 0) {
            const particle = this.activeParticles.pop();
            this.pool.release(particle);
        }
    }

    /**
     * Get current active particle count.
     */
    getActiveCount() {
        return this.activeParticles.length;
    }

    /**
     * Check if we're at or near capacity.
     */
    isNearCapacity(threshold = 0.9) {
        return this.activeParticles.length >= (this.maxParticles * threshold);
    }

    /**
     * Dispose all resources.
     */
    dispose() {
        this.clearAll();
        
        // Clean up any remaining mesh geometries/materials
        for (const particle of this.pool._unused) {
            if (particle.mesh) {
                if (particle.mesh.geometry) {
                    particle.mesh.geometry.dispose();
                }
                if (particle.mesh.material) {
                    particle.mesh.material.dispose();
                }
            }
        }
    }
}

export default ParticleManager;
