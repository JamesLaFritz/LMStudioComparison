import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { DiscardShader } from 'three/examples/jsm/shaders/DiscardShader.js';
import { PostProcessor } from '../shared/graphics/PostProcessor.js';
import { Disposer } from '../shared/graphics/Disposer.js';

export class Renderer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = 1.5;
        this.container.appendChild(this.renderer.domElement);

        this.composer = new EffectComposer(this.renderer);
        this.setupPostProcessing();
        this.setupLights();

        this.disposer = new Disposer();

        window.addEventListener('resize', () => this.onResize(), { passive: true });
    }

    setupPostProcessing() {
        const renderPass = new RenderPass(this.scene, this.renderer.domElement);
        this.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, // strength
            0.4, // radius
            0.85 // threshold
        );
        this.composer.addPass(bloomPass);

        // Scanline Shader Pass
        const scanlineShader = {
            uniforms: {
                'tDiffuse': { value: null },
                'uTime': { value: 0 },
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
                    float scanline = sin(vUv.y * 800.0 + uTime * 5.0) * 0.04 * uIntensity;
                    texel.rgb -= scanline;
                    gl_FragColor = texel;
                }
            `
        };

        this.scanlinePass = new ShaderPass(scanlineShader);
        this.composer.addPass(this.scanlinePass);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1);
        mainLight.position.set(5, 10, 7);
        this.scene.add(mainLight);
    }

    update(delta, time) {
        this.scanlinePass.uniforms.uTime.value = time;
        this.composer.render();
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
        this.scene.aspect = width / height;
    }

    add(object) {
        this.scene.add(object);
    }

    remove(object) {
        this.scene.remove(object);
    }

    dispose() {
        this.disposer.dispose(this.renderer.renderLists.elements);
        this.composer.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}
