/**
 * Scene Setup - Three.js scene initialization and rendering pipeline
 */
import { Scene as THREE_Scene, PerspectiveCamera, WebGLRenderer } from '../shared/three';

class Scene {
    constructor(container) {
        this.container = container;
        
        // Initialize Three.js components
        this.scene = new THREE_Scene();
        this.camera = new PerspectiveCamera(60, 1.75, 0.1, 1000);
        this.renderer = new WebGLRenderer({ antialias: true });
        
        // Configure renderer
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setClearColor(0x780820); // Dark space background
        
        // Add scene to container
        container.appendChild(this.renderer.domElement);
        
        // Set up camera position
        this.camera.position.set(0, 15, 30);
        this.camera.lookAt(0, 0, 0);
        
        // Initialize post-processing effects
        this._setupPostProcessing();
    }

    _setupPostProcessing() {
        // Initialize bloom effect for neon glow
        const bloomPass = new UnrealBloomPass(1.5, 0.4, 256);
        bloomPass.resolution = new Vector2(window.innerWidth / 2, window.innerHeight / 2);
        
        // Add bloom to scene's post-processing chain
        this.scene.add(bloomPass);
    }

    render(entities, cameraShakeSystem) {
        // Apply camera shake if active
        if (cameraShakeSystem && cameraShakeSystem.shakeIntensity > 0) {
            const time = performance.now() / 1000;
            
            this.camera.position.x += Math.sin(time * 30) * 
                cameraShakeSystem.shakeIntensity * 0.5;
            this.camera.position.y += Math.cos(time * 27) * 
                cameraShakeSystem.shakeIntensity * 0.3;
        }

        // Render scene with all entities
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        // Dispose of renderer and resources
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // Clear references
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
    }
}

export default Scene;
