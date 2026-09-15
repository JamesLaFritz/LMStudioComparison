import * as THREE from 'three';
import { ObjectPool } from '@shared/ObjectPool';
import { Projectile } from '../entities/Projectile.js';

export class ProjectilePool extends ObjectPool<Projectile> {
    private _activeProjectiles: Projectile[] = [];

    constructor(maxCount: number) {
        super(maxCount, () => new Projectile());
    }

    acquirePlayer(position: THREE.Vector3): Projectile | null {
        const proj = this.get();
        if (!proj) return null;
        proj.initForPlayer(position);
        this._activeProjectiles.push(proj);
        return proj;
    }

    acquireAlien(position: THREE.Vector3): Projectile | null {
        const proj = this.get();
        if (!proj) return null;
        proj.initForAlien(position);
        this._activeProjectiles.push(proj);
        return proj;
    }

    releaseProjectile(proj: Projectile): void {
        const idx = this._activeProjectiles.indexOf(proj);
        if (idx !== -1) {
            this._activeProjectiles.splice(idx, 1);
        }
        proj.reset();
        this.put(proj);
    }

    getAllActive(): Projectile[] {
        return [...this._activeProjectiles];
    }

    updateAll(delta: number, now: number): void {
        const toRemove: Projectile[] = [];
        for (const proj of this._activeProjectiles) {
            proj.update(delta, now);
            if (!proj.isActive()) {
                toRemove.push(proj);
            }
        }
        for (const proj of toRemove) {
            this.releaseProjectile(proj);
        }
    }

    disposeAll(): void {
        for (const proj of this._activeProjectiles) {
            proj.dispose();
        }
        this._activeProjectiles.length = 0;
        super.dispose();
    }
}
