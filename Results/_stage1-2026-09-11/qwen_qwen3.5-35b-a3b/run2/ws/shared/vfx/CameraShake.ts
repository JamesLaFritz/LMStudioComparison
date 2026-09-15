import { Vector3 } from 'three';

export class CameraShake {
    private intensity: number = 0;
    private decayRate: number = 0.92;
    private shakeVector: Vector3 = new Vector3();

    public trigger(impactVelocity: number, directionBias?: Vector3): void {
        const scaledImpact = Math.min(1.5, impactVelocity * 0.03);
        
        if (directionBias) {
            this.shakeVector.copy(directionBias).multiplyScalar(scaledImpact);
        } else {
            this.shakeVector.set(
                (Math.random() - 0.5) * scaledImpact,
                (Math.random() - 0.5) * scaledImpact,
                0
            );
        }
        
        this.intensity = scaledImpact;
    }

    public update(deltaTime: number): Vector3 {
        if (this.intensity <= 0.001) {
            return new Vector3(0, 0, 0);
        }

        const currentShake = this.shakeVector.clone();
        
        // Exponential decay
        this.intensity *= this.decayRate;
        
        if (this.intensity <= 0.001) {
            this.intensity = 0;
            this.shakeVector.set(0, 0, 0);
        } else {
            // Scale shake vector by decayed intensity
            const scale = this.intensity / Math.max(this.decayRate, 0.001);
            this.shakeVector.multiplyScalar(scale);
        }

        return currentShake;
    }

    public getIntensity(): number {
        return this.intensity;
    }

    public reset(): void {
        this.intensity = 0;
        this.shakeVector.set(0, 0, 0);
    }
}