/**
 * Player Ship - The player's controlled ship
 */
import { MeshStandardMaterial, BoxGeometry } from '../../shared/three';

class PlayerShip {
    constructor(x, y) {
        this.position = new Vector3(x, y);
        this.velocity = new Vector2(0, 0);
        
        // Ship properties
        this.speed = 5;
        this.width = 1.5;
        this.height = 1.5;
        this.radius = 0.75;
        
        // Create ship mesh with standard material
        this.mesh = new MeshStandardMaterial();
        this.mesh.geometry = new BoxGeometry(this.width, this.height);
        this.mesh.material.color.set(0x44ff88); // Neon green color
        
        // Add to scene
        this.scene.add(this.mesh);
    }

    update(inputManager, deltaTime) {
        // Handle input for movement
        if (inputManager.isActionActive('left')) {
            this.velocity.x = -this.speed;
        } else if (inputManager.isActionActive('right')) {
            this.velocity.x = this.speed;
        } else {
            this.velocity.x *= 0.9; // Apply friction
        }
        
        // Update position based on velocity
        this.position.x += this.velocity.x * deltaTime;
        
        // Clamp to screen bounds
        this.position.x = Math.max(-15, Math.min(15, this.position.x));
    }

    dispose() {
        // Dispose of mesh and resources
        if (this.mesh) {
            this.mesh.dispose();
        }
    }
}

export default PlayerShip;
