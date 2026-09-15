/**
 * Individual particle class for the particle system
 */
export class Particle {
    constructor() {
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.life = 0;
        this.maxLife = 1.0;
        this.size = 0.5;
        this.color = new THREE.Color(0xffffff);
        this.priority = 'medium'; // low, medium, high
        this.type = 'spark'; // spark, explosion, smoke, trail
        
        // Mesh for rendering (created on init)
        this.mesh = null;
        
        // For pooling
        this.active = false;
    }

    /**
     * Initialize particle with position and type
     */
    init(position, type = 'spark', velocity = null, color = null, life = null) {
        this.position.copy(position);
        this.type = type;
        this.life = life || (type === 'explosion' ? 0.8 : 0.5);
        this.maxLife = this.life;
        
        // Set velocity based on type or provided value
        if (velocity) {
            this.velocity.copy(velocity);
        } else {
            switch (this.type) {
                case 'explosion':
                    // Radial burst with some randomness
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 3 + Math.random() * 4;
                    this.velocity.set(
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        (Math.random() - 0.5) * 2
                    );
                    break;
                case 'spark':
                    // Fast upward sparks
                    const sparkAngle = Math.random() * Math.PI * 2;
                    const sparkSpeed = 5 + Math.random() * 5;
                    this.velocity.set(
                        Math.cos(sparkAngle) * sparkSpeed,
                        Math.sin(sparkAngle) * sparkSpeed,
                        (Math.random() - 0.5) * 3
                    );
                    break;
                case 'smoke':
                    // Slow rising smoke
                    this.velocity.set(
                        (Math.random() - 0.5) * 1,
                        0.5 + Math.random() * 1,
                        (Math.random() - 0.5) * 0.5
                    );
                    break;
                case 'trail':
                    // Follows object velocity
                    this.velocity.set(0, 0, 0);
                    break;
            }
        }
        
        // Set color based on type or provided value
        if (color) {
            this.color.copy(color);
        } else {
            switch (this.type) {
                case 'explosion':
                    this.color.setHex(0xffaa00);
                    break;
                case 'spark':
                    this.color.setHex(0xffff80);
                    break;
                case 'smoke':
                    this.color.setHex(0x888888);
                    break;
                case 'trail':
                    this.color.setHex(0x00ffff);
                    break;
            }
        }
        
        // Set size based on type
        switch (this.type) {
            case 'explosion':
                this.size = 0.8 + Math.random() * 0.5;
                this.priority = 'high';
                break;
            case 'spark':
                this.size = 0.2 + Math.random() * 0.3;
                this.priority = 'medium';
                break;
            case 'smoke':
                this.size = 1.5 + Math.random();
                this.priority = 'low';
                break;
            case 'trail':
                this.size = 0.3;
                this.priority = 'low';
                break;
        }
        
        // Create mesh if not exists or reset it
        if (!this.mesh) {
            const geometry = new THREE.PlaneGeometry(1, 1);
            const material = new THREE.MeshBasicMaterial({
                color: this.color.getHex(),
                transparent: true,
                opacity: 1,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            this.mesh = new THREE.Mesh(geometry, material);
        } else {
            this.mesh.material.color.copy(this.color);
            this.mesh.material.opacity = 1;
        }
        
        this.mesh.position.copy(this.position);
        this.mesh.scale.set(this.size, this.size, 1);
        this.active = true;
        
        return this;
    }

    /**
     * Update particle state
     */
    update(delta) {
        if (!this.active) return false;
        
        // Decrease life
        this.life -= delta;
        if (this.life <= 0) {
            this.active = false;
            return false;
        }
        
        // Apply velocity with gravity for certain types
        const gravity = this.type === 'explosion' || this.type === 'spark' ? -5 : 0;
        this.velocity.y += gravity * delta;
        
        // Update position
        this.position.x += this.velocity.x * delta;
        this.position.y += this.velocity.y * delta;
        this.position.z += this.velocity.z * delta;
        
        // Update mesh
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            
            // Fade out based on life ratio
            const lifeRatio = this.life / this.maxLife;
            this.mesh.material.opacity = lifeRatio;
            
            // Rotate for visual interest
            this.mesh.rotation.z += delta * 2;
        }
        
        return true;
    }

    /**
     * Get the mesh for rendering
     */
    getMesh() {
        return this.mesh;
    }

    /**
     * Reset particle for pooling
     */
    reset() {
        this.active = false;
        if (this.mesh) {
            this.mesh.visible = false;
        }
    }

    /**
     * Dispose of mesh resources
     */
    dispose() {
        if (this.mesh) {
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
            if (this.mesh.material) {
                this.mesh.material.dispose();
            }
            this.mesh = null;
        }
    }
}
