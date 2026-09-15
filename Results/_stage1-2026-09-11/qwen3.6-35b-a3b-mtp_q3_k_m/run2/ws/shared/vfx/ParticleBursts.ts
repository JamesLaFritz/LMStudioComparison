import { ParticleManager } from '../ParticleManager';
import type { Vector3 } from 'three';

export class ParticleBursts {
    private static instance: ParticleBursts;

    public static getInstance(): ParticleBursts {
        if (!ParticleBursts.instance) {
            ParticleBursts.instance = new ParticleBursts();
        }
        return ParticleBursts.instance;
    }

    public spawnAlienDeath(position: Vector3, colorHex: number): void {
        const count = 20 + Math.floor(Math.random() * 6);
        ParticleManager.spawnBurst(
            position.clone(),
            count,
            colorHex,
            4.0,
            0.8,
            1.5
        );
    }

    public spawnPlayerDeath(position: Vector3): void {
        const count = 40 + Math.floor(Math.random() * 10);
        ParticleManager.spawnBurst(
            position.clone(),
            count,
            0x00ffff,
            6.0,
            0.5,
            2.0
        );
    }

    public spawnShieldHit(position: Vector3, colorHex: number): void {
        ParticleManager.spawnBurst(
            position.clone(),
            5 + Math.floor(Math.random() * 3),
            colorHex,
            2.0,
            0.4,
            0.6
        );
    }

    public spawnProjectileHit(position: Vector3, isPlayerProjectile: boolean): void {
        const count = 8 + Math.floor(Math.random() * 5);
        const colorHex = isPlayerProjectile ? 0x00ffff : 0xff3366;
        ParticleManager.spawnBurst(
            position.clone(),
            count,
            colorHex,
            3.0,
            0.4,
            0.8
        );
    }

    public spawnMysteryShipDeath(position: Vector3): void {
        const count = 30 + Math.floor(Math.random() * 10);
        ParticleManager.spawnBurst(
            position.clone(),
            count,
            0xff00ff,
            5.0,
            0.6,
            1.8
        );
    }

    public dispose(): void {
        // No persistent state to clean up; ParticleManager handles its own lifecycle
    }
}
