/**
 * Projectile - Player's laser shots
 */
import { MeshStandardMaterial, CylinderGeometry } from '../../shared/three';

class Projectile {
    constructor(x, y) {
        this.position = new Vector3(x, y);
        this.velocity = new Vector2(0, 15); // Move upward
        
        // Projectile properties
        this.radius = 0.2;
        this.lifetime = 5;
        this.age = 0;
        
        // Create projectile mesh with standard material
        this.mesh = new MeshStandardMaterial();
        this.mesh.geometry = new CylinderGeometry(this.radius, this.radius, 1);
        this.mesh.material.color.set(0x44ff88); // Neon green color
        
        // Add to scene
        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        // Update position based on velocity
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        
        // Age the projectile
        this.age += deltaTime;
        
        // Return false when projectile expires or goes off screen
        return this.age < this.lifetime && this.position.y < 30;
    }

    dispose() {
        // Dispose of mesh and resources
        if (this.mesh) {
            this.mesh.dispose();
        }
    }
}

export default Projectile;
