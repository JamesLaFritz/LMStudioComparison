import { GamepadMapper } from './GamepadMapper.js';

const GAMEPAD_POLL_INTERVAL = 1000 / 60; // 60Hz gamepad polling

export class InputManager {
    constructor() {
        this.keys = new Map();
        this.gamepadIndex = null;
        this.gamepadState = GamepadMapper.getInitialGamepadState();
        this.previousGamepadState = { ...this.gamepadState };
        this.listeners = new Map();

        window.addEventListener('keydown', (e) => this._onKeyDown(e));
        window.addEventListener('keyup', (e) => this._onKeyUp(e));
        window.addEventListener('gamepadconnected', (e) => this._onGamepadConnected(e));
        window.addEventListener('gamepaddisconnected', (e) => this._onGamepadDisconnected(e));

        setInterval(() => this._pollGamepad(), GAMEPAD_POLL_INTERVAL);
    }

    _onKeyDown(e) {
        const key = e.code;
        if (!this.keys.has(key)) {
            this.keys.set(key, true);
            this._emit('press', key);
        } else {
            this.keys.set(key, true);
        }
        e.preventDefault();
    }

    _onKeyUp(e) {
        const key = e.code;
        if (this.keys.has(key)) {
            this.keys.set(key, false);
            this._emit('release', key);
        }
    }

    _onGamepadConnected(e) {
        console.log('[InputManager] Gamepad connected:', e.gamepad.index);
        this.gamepadIndex = e.gamepad.index;
    }

    _onGamepadDisconnected() {
        console.log('[InputManager] Gamepad disconnected');
        this.gamepadIndex = null;
        this.gamepadState = GamepadMapper.getInitialGamepadState();
        this.previousGamepadState = { ...this.gamepadState };
    }

    _pollGamepad() {
        if (this.gamepadIndex === null) return;

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[this.gamepadIndex];
        if (!gp) return;

        this.previousGamepadState = { ...this.gamepadState };
        this.gamepadState = GamepadMapper.readGamepad(gp);

        // Detect edge transitions (pressed this frame, wasn't pressed last frame)
        const axes = GamepadMapper.readAxes(gp);
        for (const [action, value] of Object.entries(this.gamepadState.buttons)) {
            if (value > 0.5 && !this.previousGamepadState[action]) {
                this._emit('press', `gp_${action}`);
            }
        }

        // Store axes state for axis-based actions
        this.gamepadState.axes = axes;
    }

    isPressed(action) {
        const keyMap = GamepadMapper.getKeyBindings(action);
        let anyKeyDown = false;
        for (const key of keyMap) {
            if (this.keys.get(key)) {
                anyKeyDown = true;
                break;
            }
        }

        // If gamepad is connected, also check gamepad bindings
        const gp = this._getActiveGamepad();
        if (gp && GamepadMapper.hasGamepadBindings(action)) {
            const gpAction = GamepadMapper.getGamepadBinding(action);
            const gpValue = this.gamepadState.buttons[gpAction];
            if (gpValue > 0.5) anyKeyDown = true;

            // Axis-based actions (left/right movement)
            if (action === 'moveLeft' || action === 'moveRight') {
                const axisVal = this.gamepadState.axes ? this.gamepadState.axes[gpAction] : 0;
                const threshold = GamepadMapper.getDeadzone();
                if ((action === 'moveLeft' && axisVal < -threshold) ||
                    (action === 'moveRight' && axisVal > threshold)) {
                    anyKeyDown = true;
                }
            }
        }

        return anyKeyDown;
    }

    isAxisActive(action) {
        const gp = this._getActiveGamepad();
        if (!gp || !this.gamepadState.axes) return 0;

        const axisBinding = GamepadMapper.getAxisBinding(action);
        if (axisBinding === null) return 0;

        let value = 0;
        if (action === 'moveLeft' && this.gamepadState.axes[axisBinding] !== undefined) {
            value = -this.gamepadState.axes[axisBinding];
        } else if (action === 'moveRight' && this.gamepadState.axes[axisBinding + 1] !== undefined) {
            value = this.gamepadState.axes[axisBinding + 1];
        }

        const deadzone = GamepadMapper.getDeadzone();
        return Math.abs(value) > deadzone ? value : 0;
    }

    isFiring() {
        const keyMap = GamepadMapper.getKeyBindings('fire');
        for (const key of keyMap) {
            if (this.keys.get(key)) return true;
        }

        const gp = this._getActiveGamepad();
        if (gp) {
            const gpAction = GamepadMapper.getGamepadBinding('fire');
            if (this.gamepadState.buttons[gpAction] > 0.5) return true;
        }

        return false;
    }

    _getActiveGamepad() {
        if (this.gamepadIndex === null) return null;
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        return gamepads[this.gamepadIndex] || null;
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    _emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            for (const cb of callbacks) {
                try { cb(data); } catch (e) { console.error('[InputManager] Listener error:', e); }
            }
        }
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('gamepadconnected', this._onGamepadConnected);
        window.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);
        this.listeners.clear();
        this.keys.clear();
    }
}
