import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * EffectComposerSetup - Post-processing pipeline for AAA VFX
 * 
 * Provides bloom, optional scanlines, and render passes
 * Configurable intensity based on game state chaos level
 */
export class EffectComposerSetup {
    constructor(renderer, camera, scene, width, height) {
        this.renderer = renderer;
        this.camera = camera;
        this.scene = scene;
        
        // Base composer setup
        this.composer = new EffectComposer(renderer);
        this.composer.setSize(width, height);
        
        // Render pass - base scene rendering
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);
        
        // Bloom pass - tuned for neon glow without washout
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            0.85,   // threshold - only bright surfaces emit
            1.5,    // strength - base glow intensity
            0.45    // radius - tight glow spread
        );
        this.composer.addPass(this.bloomPass);
        
        // Store current settings for dynamic adjustment
        this.baseBloomStrength = 1.5;
        this.maxBloomStrength = 2.0;
        this.currentChaosLevel = 0;
    }
    
    /**
     * Set chaos level to dynamically adjust bloom intensity
     * @param {number} chaos - 0 to 1, where 1 is maximum chaos
     */
    setChaosLevel(chaos) {
        this.currentChaosLevel = Math.max(0, Math.min(1, chaos));
        
        // Interpolate bloom strength based on chaos
        const targetStrength = THREE.MathUtils.lerp(
            this.baseBloomStrength,
            this.maxBloomStrength,
            this.currentChaosLevel
        );
        
        if (this.bloomPass) {
            this.bloomPass.strength = targetStrength;
        }
    }
    
    /**
     * Render the scene through the post-processing pipeline
     * @returns {boolean} - true if render succeeded
     */
    render() {
        try {
            this.composer.render();
            return true;
        } catch (error) {
            console.error('EffectComposer render error:', error);
            // Fallback to direct rendering
            this.renderer.render(this.scene, this.camera);
            return false;
        }
    }
    
    /**
     * Update composer size on window resize
     * @param {number} width - new canvas width
     * @param {number} height - new canvas height
     */
    resize(width, height) {
        this.composer.setSize(width, height);
        
        if (this.bloomPass) {
            this.bloomPass.resolution.set(width, height);
        }
    }
    
    /**
     * Dispose all resources
     */
    dispose() {
        // Dispose render pass
        if (this.renderPass) {
            this.renderPass.dispose();
        }
        
        // Dispose bloom pass
        if (this.bloomPass) {
            this.bloomPass.dispose();
        }
        
        // Dispose composer
        if (this.composer) {
            this.composer.dispose();
        }
    }
}

/**
 * Create a complete effect composer with all passes
 * @param {THREE.WebGLRenderer} renderer 
 * @param {THREE.Camera} camera 
 * @param {THREE.Scene} scene 
 * @param {number} width 
 * @param {number} height 
 * @returns {EffectComposerSetup}
 */
export function createEffectComposer(renderer, camera, scene, width, height) {
    return new EffectComposerSetup(renderer, camera, scene, width, height);
}
