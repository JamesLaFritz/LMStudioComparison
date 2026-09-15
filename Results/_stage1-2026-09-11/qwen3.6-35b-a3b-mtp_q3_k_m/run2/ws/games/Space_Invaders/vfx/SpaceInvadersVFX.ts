import * as THREE from 'three';
import { CameraShake } from '../../../shared/vfx/CameraShake';
import { HitStopManager, configureHitStop } from '../../../shared/vfx/HitStop';
import { spawnShockwave, update as updateShockwaves, disposeAll as disposeShockwaves } from '../../../shared/vfx/ShockwaveRings';
import { initFloatingScoreText, disposeFloatingScoreText, spawn as spawnFloatingScore, update as updateFloatingScores } from '../../../shared/vfx/FloatingScoreText';
import { ParticleBursts } from '../../../shared/vfx/ParticleBursts';

const ALIEN_COLORS = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff88, 0xff3366];
const SCORE_LABELS = ['+50', '+40', '+40', '+30', '+20'];

export class SpaceInvadersVFX {
    private cameraShake: CameraShake;
    private hitStopManager: HitStopManager;
    private particleBursts: ParticleBursts;
    private engineScene: THREE.Scene | null = null;
    private engineClock: THREE.Clock | null = null;

    constructor() {
        this.cameraShake = new CameraShake();
        this.hitStopManager = new HitStopManager();
        configureHitStop({ defaultFreezeMs: 60, maxFreezeMs: 200 });
        this.particleBursts = new ParticleBursts();
        initFloatingScoreText();
    }

    setEngine(scene: THREE.Scene, clock: THREE.Clock): void {
        this.engineScene = scene;
        this.engineClock = clock;
    }

    getShake(): CameraShake { return this.cameraShake; }
    getHitStop(): HitStopManager { return this.hitStopManager; }

    onAlienKill(row: number, position: THREE.Vector3): void {
        const color = ALIEN_COLORS[row] ?? 0xffffff;
        const label = SCORE_LABELS[row] ?? '+20';
        const hexColor = '#' + color.toString(16).padStart(6, '0');

        this.hitStopManager.requestFreeze(60);
        this.particleBursts.spawnBurst(position.clone(), 18, color, 3.0, 0.9);
        spawnShockwave(position.clone(), color, 1.5, 0.4);
        if (this.engineScene && this.engineClock) {
            spawnFloatingScore(
                { scene: this.engineScene, clock: this.engineClock },
                position.clone(), label, hexColor, 1000
            );
        }
    }

    onPlayerDeath(): void {
        this.cameraShake.addTrauma(0.35, 0.6, 12);
        this.hitStopManager.requestFreeze(150);
        const deathPos = new THREE.Vector3(0, -4, 0);
        this.particleBursts.spawnBurst(deathPos.clone(), 40, 0x00ffff, 5.0, 1.2);
        spawnShockwave(deathPos.clone(), 0x00ffff, 3.0, 0.6);
    }

    onShieldHit(position: THREE.Vector3): void {
        this.particleBursts.spawnBurst(position.clone(), 5, 0x22cc88, 1.5, 0.4);
    }

    updateShake(deltaTime: number, camera: THREE.Camera): void {
        this.cameraShake.update(deltaTime, camera);
    }

    updateHitStop(deltaMs: number): void {
        this.hitStopManager.update(deltaMs);
    }

    isFrozen(): boolean {
        return this.hitStopManager.isActive();
    }

    getFreezeScale(): number {
        if (!this.isFrozen()) return 1.0;
        const remaining = this.hitStopManager.getRemainingMs();
        if (remaining > 0) return 0.0;
        return 1.0;
    }

    updateShockwaves(now: number): void {
        updateShockwaves(now);
    }

    updateFloatingScores(): void {
        if (this.engineScene && this.engineClock) {
            updateFloatingScores({ clock: this.engineClock, scene: this.engineScene });
        }
    }

    dispose(): void {
        this.particleBursts.dispose();
        disposeShockwaves();
        disposeFloatingScoreText();
    }
}
