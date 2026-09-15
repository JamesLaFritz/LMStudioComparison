import { checkCollision } from '../../shared/collisionEngine';

export class PhysicsSystem {
    constructor() {
        this.gravity = new THREE.Vector3(0, -9.81, 0);
        this.bounciness = 0.7;
        this.friction = 0.95;
    }

    applyGravity(entity, dt) {
        entity.velocity.y += this.gravity.y * dt;
    }

    handleBoundaryCollision(entity, bounds) {
        const position = entity.position;
        
        if (position.x < bounds.min.x) {
            entity.position.x = bounds.min.x;
            entity.velocity.x *= -this.bounciness;
        } else if (position.x > bounds.max.x) {
            entity.position.x = bounds.max.x;
            entity.velocity.x *= -this.bounciness;
        }

        if (position.y < bounds.min.y) {
            entity.position.y = bounds.min.y;
            entity.velocity.y *= -this.bounceness;
        } else if (position.y > bounds.max.y) {
            entity.position.y = bounds.max.y;
            entity.velocity.y *= -this.bounciness;
        }

        return position;
    }

    applyFriction(entity, dt) {
        entity.velocity.x *= Math.pow(this.friction, dt * 60);
        entity.velocity.z *= Math.pow(this.friction, dt * 60);
    }

    update(dt) {
        // Physics calculations handled by individual entities
    }
}

