import * as THREE from 'three';
import { Input } from '@shared/Input';
import { ProjectilePool } from '../components/ProjectilePool';

export class Player {
    private mesh: THREE.Group;
    private bodyMesh: THREE.Mesh;
    private engineGlowLeft: THREE.Mesh;
    private engineGlowRight: THREE.Mesh;
    private position = new THREE.Vector3();
    private velocityX = 0;
    public readonly speed = 8.0;
    private shootCooldown = 0.0;
    private readonly shootInterval = 0.28;
    private invincibleTimer = 0.0;
    private isInvincible = false;
    private blinkPhase = 0.0;

    constructor(
        scene: THREE.Scene,
        private input: Input,
        private pool: ProjectilePool,
        boundaryLeft: number,
        boundaryRight: number,
        baseY: number
    ) {
        this.mesh = new THREE.Group();

        // Main body — wedge shape using ShapeGeometry
        const shape = new THREE.Shape();
        shape.moveTo(0, 1.2);
        shape.lineTo(-1.8, -0.6);
        shape.lineTo(-0.5, -0.4);
        shape.lineTo(0, -0.9);
        shape.lineTo(0.5, -0.4);
        shape.lineTo(1.8, -0.6);
        shape.closePath();

        const extrudeSettings: THREE.ExtrudeGeometryOptions = { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05 };
        const bodyGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        bodyGeom.center();

        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x1a3a4a,
            metalness: 0.7,
            roughness: 0.25,
            emissive: 0x00ccff,
            emissiveIntensity: 0.5,
        });
        this.bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);

        // Engine glow lights (small glowing boxes at rear)
        const glowGeom = new THREE.BoxGeometry(0.25, 0.15, 0.35);
        const glowMatL = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2.0 });
        const glowMatR = glowMatL.clone();
        this.engineGlowLeft = new THREE.Mesh(glowGeom, glowMatL);
        this.engineGlowRight = new THREE.Mesh(glowGeom, glowMatR);
        this.engineGlowLeft.position.set(-0.45, -0.65, 0.1);
        this.engineGlowRight.position.set(0.45, -0.65, 0.1);

        // Cockpit highlight
        const cockpitGeom = new THREE.SphereGeometry(0.2, 8, 6);
        const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x88ffff, emissive: 0x88ffff, emissiveIntensity: 1.5 });
        const cockpit = new THREE.Mesh(cockpitGeom, cockpitMat);
        cockpit.position.set(0, 0.3, 0.2);

        this.mesh.add(this.bodyMesh, this.engineGlowLeft, this.engineGlowRight, cockpit);
        scene.add(this.mesh);

        this.position.set(0, baseY, 0);
        this.mesh.position.copy(this.position);

        this.boundaryLeft = boundaryLeft;
        this.boundaryRight = boundaryRight;
    }

    private boundaryLeft: number;
    private boundaryRight: number;

    public update(delta: number): void {
        // Shooting
        this.shootCooldown -= delta;
        if (this.input.isFiring && this.shootCooldown <= 0) {
            this.fire();
            this.shootCooldown = this.shootInterval;
        }

        // Movement with lerp smoothing
        let inputDir = 0;
        if (this.input.isLeft()) inputDir -= 1;
        if (this.input.isRight()) inputDir += 1;

        const targetVel = inputDir * this.speed;
        this.velocityX += (targetVel - this.velocityX) * Math.min(delta * 8.0, 1.0);
        this.position.x += this.velocityX * delta;
        this.position.x = Math.max(this.boundaryLeft, Math.min(this.boundaryRight, this.position.x));

        // Blinking when invincible
        if (this.isInvincible) {
            this.invincibleTimer -= delta;
            this.blinkPhase += delta * 12.0;
            const visible = Math.sin(this.blinkPhase) > 0;
            this.bodyMesh.visible = visible;
            this.engineGlowLeft.visible = visible;
            this.engineGlowRight.visible = visible;
            if (this.invincibleTimer <= 0) {
                this.isInvincible = false;
                this.bodyMesh.visible = true;
                this.engineGlowLeft.visible = true;
                this.engineGlowRight.visible = true;
            }
        }

        // Engine glow flicker
        const flicker = 0.8 + Math.sin(Date.now() * 0.02) * 0.2;
        (this.engineGlowLeft.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 * flicker;
        (this.engineGlowRight.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 * flicker;

        this.mesh.position.copy(this.position);
    }

    private fire(): void {
        const proj = this.pool.acquire('player');
        if (!proj) return;
        proj.setPosition(this.position.x, this.position.y + 0.8, this.position.z);
        proj.setVelocity(0, -14, 0);
    }

    public takeDamage(): boolean {
        if (this.isInvincible) return false;
        this.isInvincible = true;
        this.invincibleTimer = 2.5;
        return true;
    }

    public getPosition(): THREE.Vector3 { return this.position; }
    public getBounds(): THREE.Box3 {
        const halfW = 1.0, halfH = 1.0, halfD = 0.3;
        return new THREE.Box3(
            new THREE.Vector3(this.position.x - halfW, this.position.y - halfH, this.position.z - halfD),
            new THREE.Vector3(this.position.x + halfW, this.position.y + halfH, this.position.z + halfD)
        );
    }

    public dispose(): void {
        (this.bodyMesh.geometry as THREE.BufferGeometry).dispose();
        (this.bodyMesh.material as THREE.Material).dispose();
        (this.engineGlowLeft.geometry as THREE.BufferGeometry).dispose();
        (this.engineGlowLeft.material as THREE.Material).dispose();
        (this.engineGlowRight.geometry as THREE.BufferGeometry).dispose();
        this.mesh.remove(this.bodyMesh, this.engineGlowLeft, this.engineGlowRight);
        this.engineGlowRight.material.dispose();
    }
}
