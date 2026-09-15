import { Vector3, Sprite, SpriteMaterial, CanvasTexture } from 'three';

/**
 * FloatingText - HTML overlay positioned via screen-space projection of 3D world position.
 * Creates a DOM element that follows a 3D point in the scene.
 */
export class FloatingText {
    constructor(scene) {
        this.scene = scene;
        this.elements = [];
        this._tempVec = new Vector3();
    }

    /**
     * Spawn floating text at a world position
     * @param {number} x - World X position
     * @param {number} y - World Y position
     * @param {string} text - Text to display
     * @param {string} color - CSS color string
     * @param {number} durationMs - How long the text stays visible (ms)
     */
    spawn(x, y, text, color = '#00ffcc', durationMs = 1200) {
        const el = document.createElement('div');
        el.textContent = text;
        el.style.cssText = `
            position: fixed;
            pointer-events: none;
            font-family: 'Courier New', monospace;
            font-size: 18px;
            font-weight: bold;
            color: ${color};
            text-shadow: 0 0 8px ${color}, 0 0 16px ${color};
            opacity: 1;
            transition: none;
            z-index: 100;
        `;
        document.body.appendChild(el);

        const startTime = performance.now();
        this.elements.push({ el, worldPos: new Vector3(x, y, 0), startTime, durationMs });
    }

    /**
     * Update all floating text positions each frame
     */
    update() {
        const now = performance.now();
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const entry = this.elements[i];
            const elapsed = now - entry.startTime;

            if (elapsed >= entry.durationMs) {
                entry.el.remove();
                this.elements.splice(i, 1);
                continue;
            }

            const progress = elapsed / entry.durationMs;
            const fadeStart = 0.6;
            let opacity = 1;
            if (progress > fadeStart) {
                opacity = 1 - ((progress - fadeStart) / (1 - fadeStart));
            }

            entry.el.style.opacity = Math.max(0, opacity);

            // Project world position to screen space
            this._tempVec.copy(entry.worldPos);
            this._tempVec.y += progress * 2.5; // Float upward

            const projected = this._tempVec.clone().project(this.scene.camera);
            const sx = (projected.x + 1) / 2 * window.innerWidth;
            const sy = (-projected.y + 1) / 2 * window.innerHeight;

            entry.el.style.left = `${sx}px`;
            entry.el.style.top = `${sy}px`;
            entry.el.style.transform = 'translate(-50%, -50%)';
        }
    }

    /**
     * Clear all floating text (call on scene disposal)
     */
    clear() {
        for (const entry of this.elements) {
            entry.el.remove();
        }
        this.elements.length = 0;
    }
}
