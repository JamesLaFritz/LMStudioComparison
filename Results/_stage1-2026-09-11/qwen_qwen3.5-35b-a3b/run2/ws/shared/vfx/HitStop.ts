import { Vector3 } from 'three';

export class HitStop {
    private freezeDuration: number = 0;
    private accumulatedTime: number = 0;
    private isFrozen: boolean = false;

    trigger(duration: number): void {
        this.freezeDuration = duration;
        this.accumulatedTime = 0;
        this.isFrozen = true;
    }

    update(deltaTime: number): number {
        if (this.isFrozen) {
            this.accumulatedTime += deltaTime;
            if (this.accumulatedTime >= this.freezeDuration) {
                this.reset();
                return 1.0; // Normal timescale
            }
            return 0.1; // Frozen state
        }
        return 1.0;
    }

    reset(): void {
        this.freezeDuration = 0;
        this.accumulatedTime = 0;
        this.isFrozen = false;
    }

    isCurrentlyFrozen(): boolean {
        return this.isFrozen;
    }
}