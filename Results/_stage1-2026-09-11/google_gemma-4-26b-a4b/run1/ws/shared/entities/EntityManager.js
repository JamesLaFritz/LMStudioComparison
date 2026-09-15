/**
 * @file EntityManager.js
 * @description Handles object pooling, entity lifecycle, and updates for all game entities.
 * Implements strict memory management by reusing objects to prevent GC pressure.
 */

export class Entity {
    constructor() {
        this.id = null;
        this.active = false;
        this.position = { x: 0, y: 0, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.type = 'base';
        this.userData = {};
    }

    init(id, type, position, velocity = { x: 0, y: 0, z: 0 }) {
        this.id = id;
        this.type = type;
        this.position.x = position.x;
        this.position.y = position.y;
        this.position.z = position.z;
        this.velocity.x = velocity.x;
        this.velocity.y = velocity.y;
        this.velocity.z = velocity.current || 0; // Handle potential undefined
        this.active = true;
    }

    update(dt) {
        if (!this.active) return;
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;
    }

    deactivate() {
        this.active = false;
    }
}

export class EntityManager {
    constructor() {
        this.entities = new Map();
        this.pools = new Map(); // type -> Array<Entity>
    }

    /**
     * Retrieves an entity from the pool or creates a new one.
     * @param {string} type - The entity type to retrieve.
     * @param {object} position - Initial position.
     * @param {object} velocity - Initial velocity.
     * @returns {Entity}
     */
    spawn(type, position, velocity) {
        let entity;
        const pool = this.pools.get(type);

        if (pool && pool.length > 0) {
            entity = pool.pop();
        } else {
            entity = new Entity();
            entity.type = type;
        }

        entity.init(Math.random().toString(36).substr(2, 9), type, position, velocity);
        this.entities.set(entity.id, entity);
        return entity;
    }

    /**
     * Despawns an entity and returns it to the pool.
     * @param {string} id - The entity ID.
     */
    despawn(id) {
        const entity = this.entities.get(id);
        if (entity) {
            entity.deactivate();
            this.entities.delete(id);
            
            if (!this.pools.has(entity.type)) {
                this.pools.set(entity.type, []);
            }
            this.pools.get(entity.type).push(entity);
        }
    }

    /**
     * Updates all active entities.
     * @param {number} dt - Delta time.
     */
    update(dt) {
        for (const entity of this.entities.values()) {
            if (entity.active) {
                entity.update(dt);
            }
        }
    }

    /**
     * Cleans up all entities and pools. Essential for memory management.
     */
    dispose() {
        this.entities.clear();
        for (const pool of this.pools.values()) {
            pool.length = 0;
        }
        this.pools.clear();
    }

    getEntitiesByType(type) {
        const result = [];
        for (const entity of this.entities.values()) {
            if (entity.type === type && entity.active) {
                result.push(entity);
            }
        }
        return result;
    }
}
