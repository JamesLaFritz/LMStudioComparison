import * as THREE from 'three';

const FIXED_DT = 1 / 60;

export class GameEngine {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.state = 'MENU'; // MENU | PLAY | PAUSE | GAMEOVER
        this.accumulator = 0;
        this.running = false;
        this.game = null; // reference to the game logic module

        // VFX subsystems (initialized lazily)
        this.cameraShake = null;
        this.hitStop = null;
        this.particleManager = null;
        this.motionTrails = null;
        this.shockwaveRings = null;
        this.floatingText = null;
        this.input = null;
        this.audio = null;
        this.postProcessing = null;

        // Config
        this.width = config.width || window.innerWidth;
        this.height = config.height || window.innerHeight;
        this.pixelRatio = Math.min(window.devicePixelRatio, 2);

        // --- Renderer ---
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // --- Scene ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050510);
        this.scene.fog = new THREE.FogExp2(0x050510, 0.015);

        // --- Camera ---
        this.camera = new THREE.PerspectiveCamera(
            config.fov || 60,
            this.width / this.height,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, config.cameraZ || 30);
        this.camera.lookAt(0, 0, 0);

        // --- Lighting ---
        this._setupLighting();

        // --- Post-processing (placeholder, initialized by game) ---
        this.composer = null;

        // --- Track disposables ---
        this._disposables = [];

        // --- Resize handler ---
        this._resizeHandler = this._onResize.bind(this);
        window.addEventListener('resize', this._resizeHandler);

        // --- Last frame time ---
        this._lastTime = 0;
    }

    _setupLighting() {
        // Ambient
        const ambient = new THREE.AmbientLight(0x222244, 0.5);
        this.scene.add(ambient);
        this._disposables.push(ambient);

        // Directional (main light)
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(10, 20, 15);
        dir.castShadow = true;
        dir.shadow.mapSize.set(1024, 1024);
        dir.shadow.camera.near = 0.5;
        dir.shadow.camera.far = 100;
        dir.shadow.camera.left = -30;
        dir.shadow.camera.right = 30;
        dir.shadow.camera.top = 30;
        dir.shadow.camera.bottom = -30;
        this.scene.add(dir);
        this._disposables.push(dir);

        // Point lights for neon atmosphere
        const p1 = new THREE.PointLight(0x00ffff, 1.5, 50);
        p1.position.set(-15, 5, 10);
        this.scene.add(p1);
        this._disposables.push(p1);

        const p2 = new THREE.PointLight(0xff00ff, 1.5, 50);
        p2.position.set(15, 5, 10);
        this.scene.add(p2);
        this._disposables.push(p2);
    }

    registerVFX(cameraShake, hitStop, particleManager, motionTrails, shockwaveRings, floatingText) {
        this.cameraShake = cameraShake;
        this.hitStop = hitStop;
        this.particleManager = particleManager;
        this.motionTrails = motionTrails;
        this.shockwaveRings = shockwaveRings;
        this.floatingText = floatingText;
    }

    registerInput(input) {
        this.input = input;
    }

    registerAudio(audio) {
        this.audio = audio;
    }

    registerPostProcessing(postProcessing) {
        this.postProcessing = postProcessing;
        this.composer = postProcessing.composer;
    }

    setGame(game) {
        this.game = game;
    }

    start() {
        this.running = true;
        this._lastTime = performance.now();
        this._loop();
    }

    stop() {
        this.running = false;
    }

    _loop() {
        if (!this.running) return;

        const now = performance.now();
        let frameTime = (now - this._lastTime) / 1000;
        this._lastTime = now;

        // Clamp to prevent spiral of death
        if (frameTime > 0.25) frameTime = 0.25;

        // Hit-stop timescale
        const timescale = this.hitStop ? this.hitStop.getTimescale() : 1;

        this.accumulator += frameTime;

        while (this.accumulator >= FIXED_DT) {
            this.accumulator -= FIXED_DT;
            this._update(FIXED_DT * timescale);
        }

        this._render();
        requestAnimationFrame(this._loop.bind(this));
    }

    _update(dt) {
        if (this.state === 'PLAY' && this.game) {
            this.game.update(dt, this);
        }

        // Update VFX subsystems
        if (this.cameraShake) this.cameraShake.update(dt);
        if (this.particleManager) this.particleManager.update(dt);
        if (this.motionTrails) this.motionTrails.update(dt);
        if (this.shockwaveRings) this.shockwaveRings.update(dt);
        if (this.floatingText) this.floatingText.update(dt);
    }

    _render() {
        // Apply camera shake
        if (this.cameraShake) {
            this.cameraShake.applyTo(this.camera);
        }

        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    _onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        if (this.composer) {
            this.composer.setSize(this.width, this.height);
        }
    }

    dispose() {
        this.running = false;
        window.removeEventListener('resize', this._resizeHandler);

        // Dispose tracked objects
        for (const obj of this._disposables) {
            if (obj.dispose) obj.dispose();
        }
        this._disposables.length = 0;

        // Dispose scene children
        this.scene.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

        this.renderer.dispose();
    }
}
