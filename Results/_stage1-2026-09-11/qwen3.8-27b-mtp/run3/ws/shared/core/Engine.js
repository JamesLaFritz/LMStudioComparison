// shared/core/Engine.js — renderer, scene, camera, fixed-timestep loop, disposal registry.
import * as THREE from 'three';
import { InputController } from './InputController.js';
import { HitStop } from '../vfx/HitStop.js';

const SIM_STEP = 1 / 120; // fixed simulation timestep (s)
const MAX_FRAME_DT = 0.1; // clamp pathological frame gaps (tab switch, debugger pause)

export class Engine {
	/**
	 * @param {HTMLElement} container DOM node that receives the canvas.
	 */
	constructor(container) {
		this.container = container;
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
		this.input = new InputController(window);
		this.hitStop = new HitStop();

		const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.15;
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer = renderer;
		container.appendChild(renderer.domElement);

		// Disposal registry: every tracked GPU resource is disposed exactly once on teardown.
		this._tracked = new Set();
		this.composer = null; // set by PostPipeline via setComposer()

		this._simCallback = null;
		this._renderCallback = null;
		this._accumulator = 0;
		this._lastTime = performance.now();
		this._running = false;
		this._rafId = 0;
		this._onResizeBound = () => this._handleResize();

		this.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
		window.addEventListener('resize', this._onResizeBound);
	}

	/** Register a geometry / material / texture for guaranteed disposal. */
	track(resource) {
		if (resource && typeof resource.dispose === 'function') this._tracked.add(resource);
		return resource;
	}

	setComposer(composer) {
		this.composer = composer;
	}

	/**
	 * Start the loop. simStep(hdt) runs at a fixed 120 Hz (scaled by hit-stop timescale);
	 * renderCallback(dt, elapsed) runs once per animation frame.
	 */
	start(simStep, renderCallback) {
		this._simCallback = simStep;
		this._renderCallback = renderCallback;
		if (!this._running) {
			this._running = true;
			this._lastTime = performance.now();
			const loop = (now) => {
				if (!this._running) return;
				this._rafId = requestAnimationFrame(loop);
				let dt = (now - this._lastTime) / 1000;
				this._lastTime = now;
				if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;

				// Refresh normalized input state once per frame (keyboard + gamepad).
				this.input.update();

				// Hit-stop dilates simulation time only — rendering stays real-time.
				const scaledDt = dt * this.hitStop.timescale;
				this.hitStop.update(dt); // recovery runs on wall-clock time

				let elapsed = 0;
				this._accumulator += scaledDt;
				while (this._accumulator >= SIM_STEP) {
					if (this._simCallback) this._simCallback(SIM_STEP, this.hitStop.timescale);
					this._accumulator -= SIM_STEP;
					elapsed += SIM_STEP;
				}

				if (this._renderCallback) this._renderCallback(dt, scaledDt);
				if (this.composer) this.composer.render();
				else this.renderer.render(this.scene, this.camera);
			};
			this._rafId = requestAnimationFrame(loop);
		}
	}

	stop() {
		this._running = false;
		cancelAnimationFrame(this._rafId);
	}

	setSize(width, height) {
		const w = Math.max(1, width);
		const h = Math.max(1, height);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(w, h);
		if (this.composer && this.composer.setSize) this.composer.setSize(w, h);
	}

	_handleResize() {
		const rect = this.container.getBoundingClientRect();
		this.setSize(rect.width || window.innerWidth, rect.height || window.innerHeight);
	}

	/** Full teardown: dispose every tracked resource, the composer (if any), and the renderer. */
	disposeAll() {
		this.stop();
		window.removeEventListener('resize', this._onResizeBound);
		for (const res of this._tracked) {
			try { res.dispose(); } catch (e) { /* already disposed — safe to ignore */ }
		}
		this._tracked.clear();
		if (this.composer && typeof this.composer.dispose === 'function') {
			try { this.composer.dispose(); } catch (e) { /* noop */ }
		}
		this.renderer.dispose();
		if (this.renderer.domElement.parentNode === this.container) {
			this.container.removeChild(this.renderer.domElement);
		}
	}
}
