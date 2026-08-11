import * as THREE from 'three';

const MAX_PARTICLES = 500;

class ParticleManager {
    constructor(scene) {
        this.scene = scene;
        this.activeParticles = [];
        this.pool = [];
        this.geometry = new THREE.SphereGeometry(0.06, 8, 8);
        this.baseMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
        });

        for (let i = 0; i < MAX_PARTICLES; i++) {
            const mesh = new THREE.Mesh(this.geometry, this.baseMaterial.clone());
            mesh.visible = false;
            mesh.userData = {
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: 0,
                gravity: -3.0,
                drag: 0.98,
            };
            scene.add(mesh);
            this.pool.push(mesh);
        }
    }

    burst(position, count, color, spread, lifetime) {
        const actualCount = Math.min(count, MAX_PARTICLES - this.activeParticles.length);
        for (let i = 0; i < actualCount; i++) {
            const particle = this.pool.find(p => !p.visible);
            if (!particle) break;

            particle.visible = true;
            particle.position.copy(position);

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = (0.5 + Math.random()) * spread;
            particle.userData.velocity.set(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.sin(phi) * Math.sin(theta) * speed,
                Math.cos(phi) * speed
            );

            particle.userData.life = lifetime;
            particle.userData.maxLife = lifetime;
            particle.userData.gravity = -3.0;
            particle.userData.drag = 0.98;
            particle.material.emissive.setHex(color);
            particle.material.color.setHex(color);
            particle.material.opacity = 1.0;
            particle.scale.setScalar(1.0);

            this.activeParticles.push(particle);
        }
    }

    update(deltaTime) {
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            p.userData.life -= deltaTime;

            const lifeRatio = Math.max(0, p.userData.life / p.userData.maxLife);

            p.userData.velocity.y += p.userData.gravity * deltaTime;
            p.userData.velocity.multiplyScalar(p.userData.drag);
            p.position.addScaledVector(p.userData.velocity, deltaTime);

            p.material.opacity = lifeRatio;
            p.scale.setScalar(0.3 + 0.7 * lifeRatio);

            if (p.userData.life <= 0) {
                p.visible = false;
                this.activeParticles.splice(i, 1);
            }
        }
    }

    dispose() {
        this.geometry.dispose();
        this.baseMaterial.dispose();
        for (const p of this.pool) {
            p.material.dispose();
            this.scene.remove(p);
        }
    }
}

export { ParticleManager };
