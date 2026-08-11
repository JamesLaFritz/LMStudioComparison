/**
 * FloatingScoreText — Dynamic 3D/HTML score popups with neon glow.
 * Creates DOM-based floating text elements that animate upward and fade out.
 */

export class FloatingScoreText {
    constructor(container) {
        this.container = container || document.getElementById('vfx-overlay') || document.body;
        this.activeTexts = [];
        this.idCounter = 0;
    }

    /**
     * Spawn a floating score text at a screen position.
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     * @param {string} text - Text content (e.g., "+100", "SCORE!")
     * @param {object} options - Style options
     */
    spawn(x, y, text, options = {}) {
        const id = this.idCounter++;
        const {
            color = '#00ffff',
            fontSize = 32,
            fontWeight = 'bold',
            fontFamily = "'Orbitron', 'Segoe UI', sans-serif",
            duration = 1200,
            riseDistance = 60,
            glowSize = 8,
            glowColor = color,
            scale = 1.0,
        } = options;

        const el = document.createElement('div');
        el.className = 'floating-score-text';
        el.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            color: ${color};
            font-size: ${fontSize}px;
            font-weight: ${fontWeight};
            font-family: ${fontFamily};
            text-shadow:
                0 0 ${glowSize}px ${glowColor},
                0 0 ${glowSize * 2}px ${glowColor},
                0 0 ${glowSize * 3}px ${glowColor};
            pointer-events: none;
            user-select: none;
            white-space: nowrap;
            transform: translate(-50%, -50%) scale(${scale});
            opacity: 1;
            z-index: 1000;
            transition: none;
        `;
        el.textContent = text;
        this.container.appendChild(el);

        const entry = { id, el, startTime: performance.now(), duration, riseDistance, x, y };
        this.activeTexts.push(entry);

        // Auto-cleanup after duration
        setTimeout(() => {
            this.remove(id);
        }, duration + 100);

        return id;
    }

    /**
     * Spawn a score popup projected from 3D world coordinates.
     * @param {THREE.Vector3} worldPos - World position
     * @param {string} text - Text content
     * @param {THREE.Camera} camera - Camera for projection
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {object} options - Style options
     */
    spawnFromWorld(worldPos, text, camera, width, height, options = {}) {
        const projected = worldPos.clone().project(camera);
        const screenX = (projected.x * 0.5 + 0.5) * width;
        const screenY = (-projected.y * 0.5 + 0.5) * height;
        return this.spawn(screenX, screenY, text, options);
    }

    /**
     * Update all active floating texts (animate upward + fade).
     * Call this every frame.
     */
    update() {
        const now = performance.now();
        for (let i = this.activeTexts.length - 1; i >= 0; i--) {
            const entry = this.activeTexts[i];
            const elapsed = now - entry.startTime;
            const progress = Math.min(elapsed / entry.duration, 1.0);

            // Animate upward
            const newY = entry.y - entry.riseDistance * progress;
            // Fade out in last 60% of lifetime
            const opacity = progress > 0.4 ? 1.0 - ((progress - 0.4) / 0.6) : 1.0;
            // Scale pulse at start
            const scale = progress < 0.1 ? 0.5 + 5.0 * progress : 1.0;

            entry.el.style.top = `${newY}px`;
            entry.el.style.opacity = Math.max(opacity, 0);
            entry.el.style.transform = `translate(-50%, -50%) scale(${scale})`;

            if (progress >= 1.0) {
                this._removeEntry(i);
            }
        }
    }

    /**
     * Remove a specific floating text by ID.
     */
    remove(id) {
        const idx = this.activeTexts.findIndex(e => e.id === id);
        if (idx >= 0) {
            this._removeEntry(idx);
        }
    }

    _removeEntry(index) {
        const entry = this.activeTexts[index];
        if (entry && entry.el && entry.el.parentNode) {
            entry.el.parentNode.removeChild(entry.el);
        }
        this.activeTexts.splice(index, 1);
    }

    /**
     * Clear all floating texts immediately.
     */
    clear() {
        for (const entry of this.activeTexts) {
            if (entry.el && entry.el.parentNode) {
                entry.el.parentNode.removeChild(entry.el);
            }
        }
        this.activeTexts.length = 0;
    }

    /**
     * Cleanup all resources.
     */
    dispose() {
        this.clear();
    }
}
