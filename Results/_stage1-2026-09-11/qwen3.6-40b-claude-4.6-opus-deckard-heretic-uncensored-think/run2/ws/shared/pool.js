/**
 * Object Pooling System - Reusable object management to reduce GC pressure
 */

export class ObjectPool {
    constructor(createFn, initialSize = 100) {
        this.createFn = createFn;
        this.pool = [];
        this.activeObjects = [];
        
        // Pre-allocate objects
        for (let i = 0; i < initialSize; i++) {
            const obj = createFn();
            if (obj && typeof obj.reset === 'function') {
                obj.reset();
            }
            this.pool.push(obj);
        }
    }
    
    acquire() {
        let obj = this.pool.pop();
        
        // Create new object if pool is empty
        if (!obj) {
            obj = this.createFn();
            if (typeof obj.reset === 'function') {
                obj.reset();
            }
        }
        
        this.activeObjects.push(obj);
        return obj;
    }
    
    release(obj) {
        const index = this.activeObjects.indexOf(obj);
        if (index !== -1) {
            // Remove from active list
            this.activeObjects.splice(index, 1);
            
            // Reset and return to pool
            if (typeof obj.reset === 'function') {
                obj.reset();
            }
            this.pool.push(obj);
        }
    }
    
    releaseAll() {
        this.activeObjects.forEach(obj => this.release(obj));
    }
    
    get activeCount() {
        return this.activeObjects.length;
    }
}

export class ParticlePool extends ObjectPool {
    constructor(maxParticles = 500) {
        super(() => ({
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            life: 0,
            maxLife: 1,
            size: 1,
            color: new THREE.Color(1, 1, 1),
            active: false,
            
            reset() {
                this.position.set(0, 0, 0);
                this.velocity.set(0, 0, 0);
                this.life = 0;
                this.active = false;
            }
        }), maxParticles);
        
        this.maxParticles = maxParticles;
    }
    
    acquire(position, velocity, life) {
        if (this.activeCount >= this.maxParticles) {
            // Remove oldest particle to make room
            const oldest = this.activeObjects[0];
            this.release(oldest);
        }
        
        const particle = super.acquire();
        particle.position.copy(position);
        particle.velocity.copy(velocity);
        particle.life = life;
        particle.maxLife = life;
        particle.active = true;
        return particle;
    }
}
