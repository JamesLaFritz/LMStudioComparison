import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Renderer, Scene, Camera } from 'three';

export interface BloomConfig {
    strength: number;
    radius: number;
    threshold: number;
}

const DEFAULT_BLOOM_CONFIG: BloomConfig = {
    strength: 1.2,
    radius: 0.4,
    threshold: 0.85,
};

export class PostProcessingSetup {
    private composer: EffectComposer | null = null;
    private bloomPass: UnrealBloomPass | null = null;

    public init(
        renderer: Renderer,
        scene: Scene,
        camera: Camera,
        config?: Partial<BloomConfig>
    ): void {
        const bloomCfg = { ...DEFAULT_BLOOM_CONFIG, ...(config ?? {}) };

        this.composer = new EffectComposer(renderer);

        const renderPass = new RenderPass(scene, camera);
        this.composer.addPass(renderPass);

        this.bloomPass = new UnrealBloomPass(
            { width: renderer.domElement.clientWidth, height: renderer.domElement.clientHeight },
            bloomCfg.strength,
            bloomCfg.radius,
            bloomCfg.threshold
        );
        this.composer.addPass(this.bloomPass);

        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);
    }

    public render(): void {
        if (this.composer !== null) {
            this.composer.render();
        }
    }

    public resize(width: number, height: number): void {
        if (this.composer !== null && this.bloomPass !== null) {
            this.composer.setSize(width, height);
            this.bloomPass.resolution.set(width, height);
        }
    }

    public dispose(): void {
        if (this.composer !== null) {
            while (this.composer.passes.length > 0) {
                const pass = this.composer.passes[0];
                this.composer.removePass(pass);
                if (pass.dispose != null) {
                    pass.dispose();
                }
            }
            this.composer.dispose();
            this.composer = null;
        }
        this.bloomPass = null;
    }

    public getComposer(): EffectComposer | null {
        return this.composer;
    }
}
