import * as THREE from 'three';

export interface ParticleData {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    lifetime: number;
    maxLifetime: number;
    size: number;
    color: THREE.Color;
    active: boolean;
}

const MAX_PARTICLES = 500;
const PARTICLE_GEOMETRY = new THREE.PlaneGeometry(1, 1);

export class ParticleManager {
    private particles: ParticleData[] = [];
    private instancedMesh!: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
    private dummy = new THREE.Object3D();
    private tempColor = new THREE.Color();
    private maxCount: number;

    constructor(scene: THREE.Scene, maxCount: number = MAX_PARTICLES) {
        this.maxCount = Math.min(maxCount, MAX_PARTICLES);

        const material = new THREE.MeshStandardMaterial({
            transparent: true,
            opacity: 0.9,
            emissive: new THREE.Color(1, 1, 1),
            emissiveIntensity: 0.8,
            depthWrite: false,
            side: THREE.DoubleSide,
        });

        this.instancedMesh = new THREE.InstancedMesh(PARTICLE_GEOMETRY, material, this.maxCount);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        for (let i = 0; i < this.maxCount; i++) {
            const p: ParticleData = {
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                lifetime: 0,
                maxLifetime: 1,
                size: 0.2,
                color: new THREE.Color(1, 1, 1),
                active: false,
            };
            this.particles.push(p);

            this.dummy.position.copy(p.position);
            this.dummy.scale.setScalar(0);
            this.dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
        scene.add(this.instancedMesh);
    }

    public spawnBurst(
        position: THREE.Vector3,
        count: number,
        color: THREE.Color,
        velocityRange: { min: number; max: number },
        lifetimeMin: number,
        lifetimeMax: number,
        sizeMin: number,
        sizeMax: number,
    ): void {
        let spawned = 0;
        for (let i = 0; i < this.maxCount && spawned < count; i++) {
            if (!this.particles[i].active) {
                const p = this.particles[i];
                p.active = true;
                p.position.copy(position);

                const angle = Math.random() * Math.PI * 2;
                const speed = velocityRange.min + Math.random() * (velocityRange.max - velocityRange.min);
                p.velocity.set(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    (Math.random() - 0.5) * speed * 0.5,
                );

                p.lifetime = lifetimeMin + Math.random() * (lifetimeMax - lifetimeMin);
                p.maxLifetime = p.lifetime;
                p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
                p.color.copy(color);
                spawned++;
            }
        }
    }

    public update(delta: number): void {
        let activeCount = 0;
        for (let i = 0; i < this.maxCount; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            p.lifetime -= delta;
            if (p.lifetime <= 0) {
                p.active = false;
                this.dummy.position.set(0, 0, 0);
                this.dummy.scale.setScalar(0);
                this.dummy.updateMatrix();
                this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
                continue;
            }

            const lifeRatio = p.lifetime / p.maxLifetime;
            p.position.x += p.velocity.x * delta;
            p.position.y += p.velocity.y * delta;
            p.position.z += p.velocity.z * delta;

            p.velocity.y -= 3.0 * delta; // gravity

            const scale = p.size * lifeRatio;
            this.dummy.position.copy(p.position);
            this.dummy.scale.setScalar(scale);
            this.dummy.lookAt(this.instancedMesh.parent?.localToWorld(new THREE.Vector3(0, 0, 1)) || new THREE.Vector3());
            this.dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(i, this.dummy.matrix);

            this.tempColor.copy(p.color);
            this.tempColor.multiplyScalar(lifeRatio * 0.9 + 0.1);
            this.instancedMesh.setColorAt(i, this.tempColor);

            activeCount++;
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (this.instancedMesh.instanceColor) {
            this.instancedMesh.instanceColor.needsUpdate = true;
        }
    }

    public dispose(): void {
        for (let i = 0; i < this.maxCount; i++) {
            this.particles[i].active = false;
        }
        if (this.instancedMesh) {
            this.instancedMesh.dispose();
        }
        PARTICLE_GEOMETRY.dispose();
    }

    public getActiveCount(): number {
        let count = 0;
        for (let i = 0; i < this.maxCount; i++) {
            if (this.particles[i].active) count++;
        }
        return count;
    }
}
