import { vec3, random } from './mathUtils';

export class ParticleManager {
    constructor() {
        this.particles = [];
        this.maxParticles = 500;
        this.accumulator = new Float32Array(500 * 8); // position(3), velocity(3), life, size, color(3)
    }

    emit(position, count, config) {
        if (this.particles.length + count > this.maxParticles) {
            const excess = this.particles.length + count - this.maxParticles;
            this.removeOldest(excess);
        }

        for (let i = 0; i < count; i++) {
            const particle = {
                position: vec3(position.x, position.y, position.z),
                velocity: config.velocity || vec3(random(-2, 2), random(5, 10), random(-2, 2)),
                life: config.life || random(0.5, 1.5),
                maxLife: config.life || 1.0,
                size: config.size || random(0.1, 0.5),
                color: config.color || new THREE.Color(random(), random() * 0.7, 0)
            };

            this.particles.push(particle);
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Update position
            p.position.x += p.velocity.x * dt;
            p.position.y += p.velocity.y * dt;
            p.position.z += p.velocity.z * dt;

            // Gravity on velocity
            p.velocity.y -= 9.8 * dt;

            // Reduce life
            p.life -= dt;

            // Remove dead particles
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    removeOldest(count) {
        while (count > 0 && this.particles.length > 0) {
            this.particles.shift();
            count--;
        }
    }

    clear() {
        this.particles = [];
    }

    getActiveCount() {
        return this.particles.length;
    }
}

export default ParticleManager;

