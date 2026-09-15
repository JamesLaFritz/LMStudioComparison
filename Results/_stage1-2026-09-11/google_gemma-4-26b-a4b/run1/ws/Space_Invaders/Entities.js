import { EntityBase } from '../../shared/entities/EntityBase.js';

/**
 * Represents a player-controlled ship in the game.
 */
export class Player extends EntityBase {
    constructor(scene, config) {
        super(scene);
        this.config = config;
        this.hp = 3;
        this.speed = 0.15;
        this.lastShotTime = 0;
        this.shotCooldown = 400; // ms

        // Create Geometry
        const geometry = new THREE.BoxGeometry(0.8, 0.5, 0.8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ffcc,
            emissive: 0x00ffcc,
            emissiveIntensity: 2,
            roughness: 0.1,
            metalness: 0.8
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, -5, 0);
        scene.add(this.mesh);
        this.registerEntity();
    }

    update(dt, input, entityManager, audio) {
        // Movement
        if (input.isPressed('ArrowLeft') || input.isPressed('a')) {
            this.mesh.position.x -= this.speed;
        }
        if (input.isPressed('ArrowRight') || input.isPressed('d')) {
            this.mesh.position.x += this.speed;
        }

        // Boundary constraints
        const limit = 10;
        this.mesh.position.x = Math.max(-limit, Math.min(limit, this.mesh.position.x));

        // Shooting
        const now = performance.now();
        if (input.isPressed('Space') && (now - this.lastShotTime > this.shotCooldown)) {
            this.shoot(entityManager, audio);
            this.lastShotTime = now;
        }

        // Visuals: tilt based on movement
        const targetTilt = input.isPressed('ArrowLeft') || input.isPressed('a') ? 0.2 : (input.isPressed('ArrowRight') || input.isPressed('d') ? -0.2 : 0);
        this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetTilt, 0.1);
    }

    shoot(entityManager, audio) {
        const projectile = entityManager.spawn('Projectile', {
            position: this.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
            velocity: new THREE.Vector3(0, 1, 0),
            owner: 'player'
        });
        if (projectile) {
            audio.play('laser');
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        // Trigger hit effects via engine/manager in actual implementation
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        super.dispose();
    }
}
