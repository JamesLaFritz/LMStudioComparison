/**
 * Gamepad Controller - Handles gamepad input via Gamepad API
 */
class GamepadController {
    constructor() {
        this.gamepads = {};
        this.actions = {};
        this.deadzone = 0.1;

        window.addEventListener('gamepadconnected', (event) => {
            console.log('Gamepad connected:', event.gamepad.name);
            this._handleGamepad(event.gamepad);
        });

        window.addEventListener('gamepaddisconnected', (event) => {
            console.log('Gamepad disconnected');
            delete this.gamepads[event.gamepad.id];
        });
    }

    _handleGamepad(gamepad) {
        this.gamepads[gamepad.id] = gamepad;
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const button = gamepad.buttons[i];
            if (button.pressed && !this.actions[`gamepad_${i}`]) {
                this.actions[`gamepad_${i}`] = true;
            } else if (!button.pressed && this.actions[`gamepad_${i}`]) {
                this.actions[`gamepad_${i}`] = false;
            }
        }
    }

    update() {
        const gamepads = navigator.getGamepads();
        if (gamepads && gamepads.length > 0) {
            this.gamepads[gamepads[0].id] = true;
            const leftStickX = gamepads[0].axes[0];
            const rightStickX = gamepads[0].axes[2];

            if (Math.abs(leftStickX) > this.deadzone) {
                this.actions['left'] = true;
            } else {
                this.actions['left'] = false;
            }

            if (Math.abs(rightStickX) > this.deadzone) {
                this.actions['right'] = true;
            } else {
                this.actions['right'] = false;
            }
        }
    }

    isActionActive(action) {
        return !!this.actions[action];
    }
}

export default GamepadController;
