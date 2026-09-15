import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class BloomPipeline {
    private composer: EffectComposer | null = null;
    private bloomPass: UnrealBloomPass | null = null;

    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
        this.composer = new EffectComposer(renderer);
        this.composer.addPass(new RenderPass(scene, camera));

        // Tuned for retro-futurism: intense but not washed out
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,   // strength - intense glow
            0.4,   // radius - soft spread
            0.15   // threshold - only bright emissive surfaces trigger
        );

        this.composer.addPass(this.bloomPass);
    }

    public render(deltaTime: number): void {
        if (this.composer) {
            this.composer.render();
        }
    }

    public resize(width: number, height: number): void {
        if (this.composer) {
            this.composer.setSize(width, height);
            if (this.bloomPass) {
                this.bloomPass.resolution.set(width, height);
            }
        }
    }

    public setBloomStrength(strength: number): void {
        if (this.bloomPass) {
            this.bloomPass.strength = strength;
        }
    }

    public getBloomStrength(): number {
        return this.bloomPass ? this.bloomPass.strength : 1.5;
    }

    public dispose(): void {
        if (this.composer) {
            this.composer.dispose();
            this.composer = null;
        }
        if (this.bloomPass) {
            this.bloomPass.dispose();
            this.bloomPass = null;
        }
    }
}