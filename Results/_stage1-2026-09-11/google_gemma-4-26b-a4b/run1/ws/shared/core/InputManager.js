/**
 * @file InputManager.js
 * @description Unified Dual-Input controller supporting Keyboard and Gamepad API.
 */

export class InputManager {
    constructor() {
        this.keys = new Set();
        this.gamepad = null;

        // Bind keyboard events
        window.addEventListener('keydown', (e) => this.keys.add(e.code));
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));

        // Handle Gamepad connection/disconnection
        window.addEventListener("gamepadconnected", (e) => {
            this.gamepad = e.gamepad;
        });
        window.addEventListener("gamepaddisconnected", () => {
            this.gamepad = null;
        });
    }

    /**
     * Returns the movement vector based on current input.
     * @returns {{x: number, y: number}} Normalized direction vector.
     */
    getMovementVector() {
        let x = 0;
        let y = 0;

        // Keyboard Input (WASD / Arrows)
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;

        // Gamepad Input
        if (this.gamepad) {
            const axes = this.gamepad.axes; // [0: left-x, 1: left-y, ...]
            if (Math.abs(axes[0]) > 0.1) x += axes[0];
            if (Math.abs(axes[1]) > 0.1) y += axes[1];
        }

        // Normalize vector to prevent diagonal speed boost
        const magnitude = Math.sqrt(x * x + y * y);
        if (magnitude > 0) {
            x /= magnitude;
            y /= magnitude;
        }

        return { x, y };
    }

    /**
     * Checks if the primary action button is pressed (e.g., Shooting).
     * @returns {boolean}
     */
    isActionPressed() {
        // Keyboard: Space
        if (this.keys.has('Space')) return true;

        // Gamepad: Button 0 (usually 'A' or 'Cross')
        if (this.gamepad && this.gamepad.buttons[0].pressed) return true;

        return false;
    }
}
