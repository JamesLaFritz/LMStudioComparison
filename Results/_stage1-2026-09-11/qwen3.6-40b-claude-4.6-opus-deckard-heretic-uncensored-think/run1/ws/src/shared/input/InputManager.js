/**
 * Unified Input Manager - Handles both keyboard and gamepad input
 */
class InputManager {
    constructor() {
        this.actions = {};
        this.gamepadState = { connected: false, axes: {}, buttons: {} };
        this.keyboardState = new Set();

        // Bind event handlers
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onGamepadConnected = this._onGamepadConnected.bind(this);
        this._onGamepadDisconnected = this._onGamepadDisconnected.bind(this);

        // Initialize keyboard listeners
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);

        // Listen for gamepad events
        window.addEventListener('gamepadconnected', this._onGamepadConnected);
        window.addEventListener('gamepaddisconnect', this._onGamepadDisconnected);
    }

    _onKeyDown(e) {
        if (!this.keyboardState.has(e.key)) {
            this.keyboardState.add(e.key);
            const action = this._getKeyAction(e.key);
            if (action && !this.actions[action]) {
                this.actions[action] = true;
            }
        }
    }

    _onKeyUp(e) {
        this.keyboardState.delete(e.key);
        const action = this._getKeyAction(e.key);
        if (action && this.actions[action]) {
            this.actions[action] = false;
        }
    }

    _onGamepadConnected(event) {
        console.log('Gamepad connected:', event.gamepad.name);
        this.gamepadState.connected = true;
    }

    _onGamepadDisconnected(event) {
        console.log('Game gamepad disconnected');
        this.gamepadState.connected = false;
        Object.keys(this.actions).forEach(action => {
            if (action.startsWith('gamepad_')) {
                this.actions[action] = false;
            }
        });
    }

    _getKeyAction(key) {
        const keyMap = {
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'w': 'left',
            'a': 'left',
            's': 'right',
            'd': 'right ',
            ' ': 'fire',
            'Enter': 'start'
        };
        return keyMap[key.toLowerCase()] || null;
    }

    update() {
        const gamepads = navigator.getGamepumps();
        if (gamepads && gamepads.length > 0) {
            this.gamepadState.connected = true;
            const gamepad = gamepads[0];
            this.gamepadState.axes.left = gamepad.axes[0] || 0;
            this.gamepadState.axes.right = gamepadState.axes[2] || 0;

            for (let i = 0; i < gamepad.buttons.length; i++) {
                const button = gamepad.buttons[i];
                if (button.pressed && !this.actions[`gamepad_${i}`]) {
                    this.actions[`gamepad_${i}`] = true;
                } else if (!button.pressed && this.actions[`gamepad_${i}`]) {
                    this.actions[`gamepad_${i}`] = false;
                }
            }
        }
    }

    isActionActive(action) {
        return !!this.actions[action];
    }

    destroy() {
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup ', this._onKeyUp);
        window.removeEventListener('gamepadconnected', this._onGamepadConnected);
        window.removeEventListener('gamepaddisconnect', this._onGamepadDisconnected);
        Object.keys(this.actions).forEach(action => {
            delete this.actions[action];
        });
    }
}

export default InputManager;


