import * as THREE from 'three';

export interface HitStopConfig {
    defaultFreezeMs: number;
    maxFreezeMs: number;
}

const DEFAULT_CONFIG: HitStopConfig = {
    defaultFreezeMs: 60,
    maxFreezeMs: 200,
};

let config: HitStopConfig = { ...DEFAULT_CONFIG };

export function configureHitStop(cfg: Partial<HitStopConfig>): void {
    if (cfg.defaultFreezeMs !== undefined) config.defaultFreezeMs = cfg.defaultFreezeMs;
    if (cfg.maxFreezeMs !== undefined) config.maxFreezeMs = cfg.maxFreezeMs;
}

export function getDefaultFreezeMs(): number { return config.defaultFreezeMs; }
export function getMaxFreezeMs(): number { return config.maxFreezeMs; }

let _instance: HitStopManager | null = null;

export class HitStopManager {
    private active: boolean = false;
    private remainingMs: number = 0;
    private elapsedMs: number = 0;

    constructor() {
        if (_instance) throw new Error('HitStopManager is a singleton');
        _instance = this;
    }

    static getDefault(): HitStopManager {
        return _instance!;
    }

    requestFreeze(durationMs: number): void {
        const capped = Math.min(durationMs, config.maxFreezeMs);
        if (!this.active || capped > this.remainingMs) {
            this.active = true;
            this.remainingMs = capped;
            this.elapsedMs = 0;
        }
    }

    update(deltaMs: number): void {
        if (!this.active) return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= this.remainingMs) {
            this.active = false;
            this.elapsedMs = 0;
            this.remainingMs = 0;
        }
    }

    isActive(): boolean { return this.active; }
    getRemainingMs(): number { return Math.max(0, this.remainingMs - this.elapsedMs); }
}
