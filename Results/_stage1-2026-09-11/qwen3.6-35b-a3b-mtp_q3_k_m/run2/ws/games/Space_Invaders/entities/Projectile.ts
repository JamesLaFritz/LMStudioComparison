import * as THREE from 'three';

const PROJECTILE_WIDTH = 0.25;
const PROJECTILE_HEIGHT = 0.8;
const PROJECTILE_DEPTH = 0.15;

export class Projectile {
    private mesh: THREE.Mesh;
    private velocity: THREE.Vector3;
    public owner: 'player' | 'alien';
    private material: THREE.MeshStandardMaterial;
    private trailPositions: Array<{ pos: THREE.Vector3; time: number }> = [];
    private lastTrailTime: number = 0;
    private active: boolean = false;

    constructor() {
        const geometry = new THREE.BoxGeometry(PROJECTILE_WIDTH, PROJECTILE_HEIGHT, PROJECTILE_DEPTH);
        this.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x00ffff,
            emissiveIntensity: 1.5,
            roughness: 0.3,
            metalness: 0.7,
        });
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.velocity = new THREE.Vector3(0, -12, 0);
        this.owner = 'player';
    }

    initForPlayer(position: THREE.Vector3): void {
        this.mesh.position.copy(position);
        this.mesh.visible = true;
        this.active = true;
        this.trailPositions.length = 0;
        this.lastTrailTime = 0;
        this.owner = 'player';
    }

    initForAlien(position: THREE.Vector3): void {
        this.mesh.position.copy(position);
        this.mesh.visible = true;
        this.active = true;
        this.trailPositions.length = 0;
        this.lastTrailTime = 0;
        this.owner = 'alien';
    }

    reset(): void {
        this.mesh.visible = false;
        this.active = false;
        this.trailPositions.length = 0;
        this.lastTrailTime = 0;
    }

    update(delta: number, now: number): void {
        if (!this.active) return;

        this.mesh.position.x += this.velocity.x * delta;
        this.mesh.position.y += this.velocity.y * delta;

        // Trail recording
        const trailInterval = 0.025;
        if (now - this.lastTrailTime > trailInterval) {
            this.trailPositions.push({
                pos: new THREE.Vector3(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z),
                time: now,
            });
            // Keep only last 8 positions
            while (this.trailPositions.length > 8) {
                this.trailPositions.shift();
            }
            this.lastTrailTime = now;
        }

        // Deactivate if off-screen
        if (this.mesh.position.y < -10 || this.mesh.position.y > 20) {
            this.active = false;
            this.mesh.visible = false;
        }
    }

    getVelocity(): THREE.Vector3 {
        return this.velocity;
    }

    setVelocity(vx: number, vy: number): void {
        this.velocity.set(vx, vy, 0);
    }

    getPosition(): THREE.Vector3 {
        return this.mesh.position;
    }

    getMesh(): THREE.Mesh {
        return this.mesh;
    }

    setActive(active: boolean): void {
        this.active = active;
        this.mesh.visible = active;
    }

    isActive(): boolean {
        return this.active;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        this.material.dispose();
    }
}
