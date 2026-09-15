import * as THREE from 'three';

export interface CameraShakeConfig {
    intensity: number;
    duration: number;
    frequency: number;
}

export class CameraShake {
    private shakeQueue: Array<{
        intensity: number;
        remainingTime: number;
        frequency: number;
        elapsed: number;
    }> = [];
    private currentOffset = new THREE.Vector3();
    private lastTime = 0;

    get offset(): THREE.Vector3 { return this.currentOffset; }

    addTrauma(intensity: number, duration: number, frequency: number = 12): void {
        this.shakeQueue.push({
            intensity,
            remainingTime: duration,
            frequency,
            elapsed: 0,
        });
    }

    update(deltaTime: number, camera: THREE.Camera): void {
        if (this.shakeQueue.length === 0) {
            this.currentOffset.set(0, 0, 0);
            return;
        }

        const dt = Math.min(deltaTime, 0.1);
        let activeShake = false;

        for (let i = this.shakeQueue.length - 1; i >= 0; i--) {
            const shake = this.shakeQueue[i];
            shake.elapsed += dt;
            shake.remainingTime -= dt;

            if (shake.remainingTime <= 0) {
                this.shakeQueue.splice(i, 1);
                continue;
            }

            activeShake = true;
            const t = shake.elapsed * shake.frequency * Math.PI * 2;
            const decayedIntensity = shake.intensity * Math.pow(0.95, shake.elapsed * 60);

            this.currentOffset.x += Math.sin(t) * decayedIntensity * dt * 10;
            this.currentOffset.y += Math.cos(t * 1.3) * decayedIntensity * dt * 5;

            if (shake.intensity > 0.2) {
                this.currentOffset.z += Math.sin(t * 0.7) * decayedIntensity * dt * 2;
            }
        }

        camera.position.add(this.currentOffset);
        this.currentOffset.multiplyScalar(0.9);
    }

    reset(): void {
        this.shakeQueue = [];
        this.currentOffset.set(0, 0, 0);
    }
}
