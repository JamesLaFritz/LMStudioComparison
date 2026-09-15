import * as THREE from 'three';
import { EnemyType } from '../../shared/utils/ProceduralTextures';
import { ObjectPool } from '../../shared/core/ObjectPool';

export class Boss {
    public mesh: THREE.Mesh;
    public position: THREE.Vector3 = new THREE.Vector3();
    public health: number = 50;
    public maxHealth: number = 50;
    public scoreValue: number = 100;
    public active: boolean = true;
    public isBoss: boolean = true;
    
    private shootTimer: number = 0;
    private shootInterval: number = 1.5; // seconds
    private patternPhase: number = 0; // 0: spread, 1: aimed, 2: spiral
    private basePosition: THREE.Vector3 = new THREE.Vector3();

    constructor(pool: ObjectPool<any>, position: THREE.Vector3) {
        this.basePosition.copy(position);
        
        const geometry = new THREE.BoxGeometry(5, 4, 2.5);
        const material = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            emissive: 0xFFA500,
            emissiveIntensity: 3,
            metalness: 0.8,
            roughness: 0.2
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.position.copy(position);
        this.mesh.position.copy(this.position);
    }

    public update(deltaTime: number): void {
        if (!this.active) return;

        // Boss movement pattern - oscillates horizontally
        const time = Date.now() * 0.001;
        this.position.x = this.basePosition.x + Math.sin(time * 0.5) * 20;
        
        // Shooting logic with pattern phases
        this.shootTimer += deltaTime;
        if (this.shootTimer >= this.shootInterval) {
            this.shootTimer = 0;
            this.fire();
        }
    }

    private fire(): void {
        const bulletSpeed = -150; // upward
        
        switch (this.patternPhase) {
            case 0: // Spread pattern
                for (let i = -2; i <= 2; i++) {
                    this.createBullet(i * 30, bulletSpeed);
                }
                break;
                
            case 1: // Aimed at player
                const targetX = 0; // Simplified for now
                const dx = (targetX - this.position.x) / Math.abs(targetX - this.position.x + 0.001);
                this.createBullet(dx * 50, bulletSpeed);
                break;
                
            case 2: // Spiral pattern
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const vx = Math.cos(angle) * 40;
                    this.createBullet(vx, bulletSpeed);
                }
                break;
        }

        // Cycle pattern phase
        this.patternPhase = (this.patternPhase + 1) % 3;
    }

    private createBullet(lateralVelocity: number, verticalVelocity: number): void {
        // This will be handled by the game manager
    }

    public onDeath(): void {
        this.active = false;
        
        // Boss death triggers massive shockwave
    }

    public dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.MeshStandardMaterial).dispose();
    }
}