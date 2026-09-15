import { Vector3 } from 'three';

export class GameLoop {
    private lastTime: number = 0;
    private accumulator: number = 0;
    private fixedStep: number = 1 / 60;
    private maxSubSteps: number = 5;
    
    private timescale: number = 1.0;
    private isPaused: boolean = false;

    constructor() {
        this.lastTime = performance.now();
    }

    public update(): void {
        if (this.isPaused) return;

        const currentTime: number = performance.now();
        let deltaTime: number = (currentTime - this.lastTime) * this.timescale;
        this.lastTime = currentTime;

        // Cap delta time to prevent huge jumps on tab switch
        deltaTime = Math.min(deltaTime, 0.1);

        this.accumulator += deltaTime;

        while (this.accumulator >= this.fixedStep && this.maxSubSteps > 0) {
            this.step(this.fixedStep);
            this.accumulator -= this.fixedStep;
            this.maxSubSteps--;
        }

        this.maxSubSteps = 5; // Reset for next frame
    }

    private step(deltaTime: number): void {
        // Override in subclass
    }

    public setTimescale(scale: number): void {
        this.timescale = Math.max(0, Math.min(1, scale));
    }

    public getTimescale(): number {
        return this.timescale;
    }

    public pause(): void {
        this.isPaused = true;
    }

    public resume(): void {
        this.isPaused = false;
        this.lastTime = performance.now();
    }

    public reset(): void {
        this.accumulator = 0;
        this.timescale = 1.0;
        this.lastTime = performance.now();
    }
}
