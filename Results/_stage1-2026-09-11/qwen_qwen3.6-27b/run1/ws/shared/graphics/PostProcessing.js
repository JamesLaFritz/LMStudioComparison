import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class PostProcessing {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        this.composer = new EffectComposer(renderer);

        // Render pass — renders the scene to a render target
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);

        // Bloom pass — tuned for neon glow without washout
        this.bloomPass = new UnrealBloomPass(
            window.innerWidth,
            window.innerHeight,
            1.2,   // strength
            0.4,   // radius
            0.6   // threshold
        );
        this.composer.addPass(this.bloomPass);

        this._boundResize = this._onResize.bind(this);
        window.addEventListener('resize', this._boundResize);
    }

    setBloom(strength, radius, threshold) {
        this.bloomPass.strength = strength;
        this.bloomPass.radius = radius;
        this.bloomPass.threshold = threshold;
    }

    render() {
        this.composer.render();
    }

    _onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.bloomPass.resolution.set(w, h);
    }

    dispose() {
        window.removeEventListener('resize', this._boundResize);
        this.renderPass.dispose?.();
        this.bloomPass.dispose?.();
        this.composer.dispose?.();
    }
}
