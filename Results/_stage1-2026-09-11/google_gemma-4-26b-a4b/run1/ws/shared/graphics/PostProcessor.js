import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Handles the post-processing stack for the game, including Bloom and CRT scanline effects.
 */
export class PostProcessor {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        this.composer = new EffectComposer(renderer);
        
        // 1. Render Pass
        const renderPass = new RenderPass(scene, camera);
        this.composer.addPass(renderPass);

        // 2. Unreal Bloom Pass (Neon Glow)
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,  // strength
            0.4,  // radius
            0.85  // threshold
        );
        this.composer.addPass(bloomPass);
        this.bloomPass = bloomPass;

        // 3. CRT Scanline Shader Pass
        const scanlineShader = {
            uniforms: {
                'tDiffuse': { value: null },
                'uTime': { value: 0.0 },
                'uIntensity': { value: 0.1 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float uTime;
                uniform float uIntensity;
                varying vec2 vUv;

                void main() {
                    vec4 texel = texture2D(tDiffuse, vUv);
                    // Create horizontal scanline effect using sine wave based on UV.y
                    float scanline = sin(vUv.y * 800.0 + uTime * 10.0) * 0.04;
                    texel.rgb -= scanlamine * uIntensity;
                    gl_FragColor = texel;
                }
            `
        };

        // Note: Fixed typo in shader 'scanline' from 'scanlamine'
        const scanlineShaderFixed = {
            uniforms: {
                'tDiffuse': { value: null },
                'uTime': { value: 0.0 },
                'uIntensity': { value: 0.1 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float uTime;
                uniform float uIntensity;
                varying vec2 vUv;

                void main() {
                    vec4 texel = texture2D(tDiffuse, vUv);
                    float scanline = sin(vUv.y * 800.0) * 0.05;
                    texel.rgb -= scanline * uIntensity;
                    gl_FragColor = texel;
                }
            `
        };

        this.scanlinePass = new ShaderPass(scanlineShaderFixed);
        this.composer.addPass(this.scanlinePass);

        // Handle resizing
        window.addEventListener('resize', () => this.onResize(), { once: false });
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
        this.bloomPass.setSize(width, height);
    }

    update(deltaTime) {
        this.scanlinePass.uniforms.uTime.value += deltaTime;
        this.composer.render();
    }

    dispose() {
        this.composer.dispose();
    }
}
