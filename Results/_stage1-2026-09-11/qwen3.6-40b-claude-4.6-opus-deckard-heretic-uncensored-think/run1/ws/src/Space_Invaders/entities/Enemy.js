/**
 * Enemy - The invading alien ships
 */
import { MeshStandardMaterial, BoxGeometry } from '../../shared/three';

class Enemy {
    constructor(x, y) {
        this.position = new Vector3(x, y);
        this.velocity = new Vector2(0, 0);
        
        // Enemy properties
        this.width = 1.5;
        this.height = 1.5;
        this.radius = 0.75;
        this.health = 1;
        
        // Movement pattern
        this.moveDirection = 1;
        this.moveSpeed = 2;
        this.fireInterval = 3;
        this.fireTimer = Math.random() * 2;
        
        // Create enemy mesh with standard material
        this.mesh = new MeshStandardMaterial();
        this.mesh.geometry = new BoxGeometry(this.width, this.height);
        this.mesh.material.color.set(0xff4444); // Red color for enemies
        
        // Add to scene
        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        // Move enemy horizontally with zigzag pattern
        this.velocity.x = this.moveDirection * this.moveSpeed;
        
        // Update position based on velocity
        this.position.x += this.velocity.x * deltaTime;
        
        // Change direction when hitting bounds
        if (this.position.x > 15 || this.position.x < -15) {
            this.moveDirection *= -1;
        }
        
        // Fire at player periodically
        this.fireTimer -= deltaTime;
        if (this.fireTimer <= 0) {
            this.fire();
            this.fireTimer = this.fireInterval;
        }
    }

    fire() {
        // Create projectile from enemy position
        const projectile = new Projectile(this.position.x, this.position.y);
        return projectile;
    }

    dispose() {
        // Dispose of mesh and resources
        if (this.mesh) {
            this.mesh.dispose();
        }
    }
}

export default Enemy;
