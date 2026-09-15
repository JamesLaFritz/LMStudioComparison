import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass } from 'three/examples/addons/PostProcessing.module.js';

export class RenderSystem {
    constructor(scene) {
        this.scene = scene;
        this.composer = null;
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Camera parameters for isometric view
        this.basePosition = new THREE.Vector3(0, 25, 30);
        this.targetPosition = new THREE.Vector3(0, 15, 20);
        
        // Screen shake state
        this.shakeIntensity = 0;
        this.shakeDecayRate = 0.9;
        
        // Initialize camera position
        this.camera.position.copy(this.basePosition);
        this.camera.lookAt(0, 0, 0);
    }

    setup(renderer) {
        // Create EffectComposer for post-processing
        this.composer = new EffectComposer(renderer);
        this.composer.setSize(window.innerWidth, window.innerHeight);

        // Add render pass
        const renderPass = new RenderPass(this.scene);
        this.composer.addPass(renderPass);

        // Add bloom pass for neon glow effect
        const bloomPass = new UnrealBloomPass(1.2, 0.5, 1.5);
        this.composer.addPass(bloomPass);
    }

    update(deltaTime) {
        // Decay screen shake intensity exponentially
        if (this.shakeIntensity > 0.001) {
            this.shakeIntensity *= Math.pow(this.shakeDecayRate, deltaTime * 60);
        } else {
            this.shakeIntensity = 0;
        }

        // Apply camera shake based on intensity
        const time = performance.now() / 1000;
        const shakeX = this.shakeIntensity * Math.sin(time * 50) * 0.01;
        const shakeY = this.shakeIntensity * Math.cos(time * 47) * 0.01;

        // Smooth camera follow with shake offset
        this.camera.position.x += (this.targetPosition.x - this.camera.position.x) * 0.1 + shakeX;
        this.camera.position.y += (this.targetPosition.y - this.camera.position.y) * 0.1 + shakeY;
    }

    triggerShake(intensity) {
        // Cap maximum shake intensity
        this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 2.0);
    }

    render() {
        if (this.composer) {
            this.composer.render();
        } else {
            console.warn('EffectComposer not initialized');
        }
    }
}

