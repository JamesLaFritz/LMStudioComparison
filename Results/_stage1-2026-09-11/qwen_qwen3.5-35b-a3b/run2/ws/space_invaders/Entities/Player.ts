import { Vector3, Mesh, MeshStandardMaterial, Group } from 'three';
import { ObjectPool } from '../../shared/core/ObjectPool';
import { Bullet } from '../Projectiles/Bullet';

export class Player {
    private position: Vector3;
    private velocity: number = 0;
    private speed: number = 400;
    private mesh: Group;
    private material: MeshStandardMaterial;
    private isDead: boolean = false;
    private respawnTimer: number = 0;
    private invulnerable: boolean = false;
    private invulnerabilityTime: number = 2.0;

    constructor() {
        this.position = new Vector3(0, -28, 0);
        
        // Create player ship group
        this.mesh = new Group();
        
        // Main body
        const bodyGeo = new THREE.BoxGeometry(4, 1.5, 2);
        this.material = new MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x0088ff,
            emissiveIntensity: 1.5,
            metalness: 0.6,
            roughness: 0.3
        });
        const body = new Mesh(bodyGeo, this.material);
        body.position.y = 0.5;
        this.mesh.add(body);

        // Turret
        const turretGeo = new THREE.BoxGeometry(1.5, 1, 1.5);
        const turret = new Mesh(turretGeo, this.material.clone());
        turret.position.y = 1.25;
        this.mesh.add(turret);

        // Wings
        const wingGeo = new THREE.BoxGeometry(0.8, 0.5, 1);
        const leftWing = new Mesh(wingGeo, this.material.clone());
        leftWing.position.set(-2.2, 0.25, 0);
        this.mesh.add(leftWing);

        const rightWing = new Mesh(wingGeo, this.material.clone());
        rightWing.position.set(2.2, 0.25, 0);
        this.mesh.add(rightWing);

        // Engine glow
        const engineGeo = new THREE.BoxGeometry(0.5, 0.3, 0.1);
        const engineMat = new MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 2.0
        });
        const leftEngine = new Mesh(engineGeo, engineMat);
        leftEngine.position.set(-1.5, 0.1, -1);
        this.mesh.add(leftEngine);

        const rightEngine = new Mesh(engineGeo, engineMat);
        rightEngine.position.set(1.5, 0.1, -1);
        this.mesh.add(rightEngine);

        this.mesh.position.copy(this.position);
    }

    public update(deltaTime: number, inputX: number): void {
        if (this.isDead) {
            this.respawnTimer -= deltaTime;
            if (this.respawnTimer <= 0) {
                this.isDead = false;
                this.invulnerable = true;
                this.respawnTimer = this.invulnerabilityTime;
            }
            return;
        }

        // Movement with friction
        const targetVelocity = inputX * this.speed;
        this.velocity += (targetVelocity - this.velocity) * 10 * deltaTime;
        
        this.position.x += this.velocity * deltaTime;

        // Boundary constraints
        this.position.x = Math.max(-30, Math.min(30, this.position.x));
        this.mesh.position.copy(this.position);

        // Blink when invulnerable
        if (this.invulnerable) {
            const blinkRate = 10;
            const shouldShow = Math.floor(Date.now() * 0.01) % Math.ceil(blinkRate / 2) === 0;
            this.mesh.visible = shouldShow;
        } else {
            this.mesh.visible = true;
        }

        if (this.invulnerable) {
            this.invulnerabilityTime -= deltaTime;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
    }

    public shoot(): Bullet | null {
        if (this.isDead) return null;
        
        const bullet = new Bullet(this.position.clone());
        bullet.setPosition(this.position.x, -27, 0);
        return bullet;
    }

    public die(): void {
        this.isDead = true;
        this.respawnTimer = 1.5; // Brief delay before respawn
    }

    public isAlive(): boolean {
        return !this.isDead;
    }

    public getMesh(): Group {
        return this.mesh;
    }

    public getPosition(): Vector3 {
        return this.position;
    }

    public getBoundingBox(): { x: number; y: number; width: number; height: number } {
        if (this.isDead) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        return {
            x: this.position.x - 2.5,
            y: this.position.y - 1,
            width: 5,
            height: 2.5
        };
    }

    public dispose(): void {
        this.mesh.traverse((child) => {
            if (child instanceof Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
}