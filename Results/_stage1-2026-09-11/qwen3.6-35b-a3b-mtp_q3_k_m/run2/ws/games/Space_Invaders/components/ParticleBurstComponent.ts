import { ParticleManager } from '../../../shared/ParticleManager';
import { ShockwaveRings } from '../../../shared/vfx/ShockwaveRings';
import { FloatingScoreText } from '../../../shared/vfx/FloatingScoreText';

export class ParticleBurstComponent {
    private particleManager: ParticleManager;
    private shockwaveRings: ShockwaveRings;
    private floatingScoreText: FloatingScoreText;

    constructor(
        particleManager: ParticleManager,
        shockwaveRings: ShockwaveRings,
        floatingScoreText: FloatingScoreText
    ) {
        this.particleManager = particleManager;
        this.shockwaveRings = shockwaveRings;
        this.floatingScoreText = floatingScoreText;
    }

    onAlienDeath(position: THREE.Vector3, color: string): void {
        const count = 20 + Math.floor(Math.random() * 6);
        this.particleManager.spawnBurst(
            position.clone(),
            count,
            color,
            4.0,
            1.0
        );
    }

    onPlayerDeath(position: THREE.Vector3): void {
        const count = 40 + Math.floor(Math.random() * 10);
        this.particleManager.spawnBurst(
            position.clone(),
            count,
            '#00ffff',
            6.0,
            1.5
        );
    }

    onShieldHit(position: THREE.Vector3): void {
        this.particleManager.spawnBurst(
            position.clone(),
            5,
            '#88ff88',
            2.0,
            0.4
        );
    }

    onProjectileMiss(position: THREE.Vector3): void {
        this.particleManager.spawnBurst(
            position.clone(),
            3,
            '#ffffff',
            1.5,
            0.3
        );
    }
}
