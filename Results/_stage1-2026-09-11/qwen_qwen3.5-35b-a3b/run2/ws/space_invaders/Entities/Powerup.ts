import * as THREE from 'three';
import { Game } from '../Game';

export enum PowerupType {
    SPREAD_SHOT = 0,
    RAPID_FIRE = 1,
    EXTRA_LIFE = 2,
    SHIELD_BOOST = 3
}

export class Powerup extends THREE.Mesh {
    private game: Game;
    private type: PowerupType;
    private velocityY: number = -50;
    private lifetime: number = 10; // seconds
    private active: boolean = false;
    private rotationSpeed: number = Math.PI / 2;

    constructor(game: Game) {
        let color = new THREE.Color();

        switch (PowerupType.SPREAD_SHOT) {
            case PowerupType.SPREAD_SHOT: color = new THREE.Color('#f0f'); break; // Spread shot
            case PowerupType.RAPID_FIRE: color = new THREE.Color('#ff0'); break; // Rapid fire
            case PowerupType.EXTRA_LIFE: color = new THREE.Color('#0f0'); break; // Extra life
            case PowerupType.SHIELD_BOOST: color = new THREE.Color('#0ff'); break; // Shield boost
        }

        const geometry = new THREE.RingGeometry(1, 1.5, 8);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 2,
            side: THREE.DoubleSide
        });

        super(geometry, material);

        this.game = game;
        this.type = PowerupType.SPREAD_SHOT; // Default
    }

    public initialize(position: THREE.Vector3): void {
        this.position.copy(position);
        this.active = true;
        this.lifetime = 10;
        
        // Random power-up type
        const types = Object.values(PowerupType).filter(t => typeof t === 'number');
        this.type = types[Math.floor(Math.random() * types.length)] as PowerupType;
    }

    public update(deltaTime: number): void {
        if (!this.active) return;

        this.position.y += this.velocityY * deltaTime;
        this.lifetime -= deltaTime;
        
        // Rotate for visual effect
        this.rotation.z += this.rotationSpeed * deltaTime;

        if (this.lifetime <= 0) {
            this.active = false;
        }
    }

    public deactivate(): void {
        this.active = false;
    }

    public getType(): PowerupType {
        return this.type;
    }

    public isActive(): boolean {
        return this.active;
    }

    public dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
    }
}