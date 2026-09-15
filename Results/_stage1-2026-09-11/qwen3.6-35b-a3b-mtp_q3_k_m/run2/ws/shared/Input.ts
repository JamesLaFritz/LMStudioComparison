import * as THREE from 'three';

export interface InputState {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    fire: boolean;
}

const KEY_MAP: Record<string, keyof InputState> = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    KeyA: 'left',
    KeyD: 'right',
    KeyW: 'up',
    KeyS: 'down',
    Space: 'fire',
};

const GAMEPAD_BUTTON_FIRE = 0; // A button
const GAMEPAD_AXIS_LEFT_X = 0;
const GAMEPAD_AXIS_RIGHT_Y = 1;

export class InputManager {
    private keys: Set<string> = new Set();
    private state: InputState = {
        left: false,
        right: false,
        up: false,
        down: false,
        fire: false,
    };
    private gamepadIndex: number | null = null;

    constructor() {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            this.keys.add(e.code);
            e.preventDefault();
        });
        window.addEventListener('keyup', (e: KeyboardEvent) => {
            this.keys.delete(e.code);
            e.preventDefault();
        });

        window.addEventListener('gamepadconnected', () => {
            const gamepads = navigator.getGamepads();
            for (let i = 0; i < gamepads.length; i++) {
                if (gamepads[i]) {
                    this.gamepadIndex = i;
                    break;
                }
            }
        });

        window.addEventListener('gamepaddisconnected', () => {
            const gamepads = navigator.getGamepads();
            let found: number | null = null;
            for (let i = 0; i < gamepads.length; i++) {
                if (gamepads[i]) {
                    found = i;
                    break;
                }
            }
            this.gamepadIndex = found;
        });
    }

    public getState(): InputState {
        const newState: InputState = {
            left: false,
            right: false,
            up: false,
            down: false,
            fire: false,
        };

        // Keyboard input
        for (const key of this.keys) {
            if (KEY_MAP[key]) {
                newState[KEY_MAP[key]] = true;
            }
        }

        // Gamepad input
        const gpIndex = this.gamepadIndex;
        if (gpIndex !== null) {
            const gamepad = navigator.getGamepads()[gpIndex];
            if (gamepad) {
                // Check buttons
                for (let i = 0; i < gamepad.buttons.length; i++) {
                    if (gamepad.buttons[i].pressed) {
                        if (i === GAMEPAD_BUTTON_FIRE || i === 2) {
                            newState.fire = true;
                        }
                        if (i === 14 || i === 15) { // D-pad or right stick buttons
                            if (i === 14) newState.left = true;
                            if (i === 15) newState.right = true;
                        }
                    }
                }

                // Check axes with deadzone
                const axes = gamepad.axes;
                const DEADZONE = 0.3;

                if (Math.abs(axes[GAMEPAD_AXIS_LEFT_X]) > DEADZONE) {
                    if (axes[GAMEPAD_AXIS_LEFT_X] < -DEADZONE) newState.left = true;
                    else if (axes[GAMEPAD_AXIS_LEFT_X] > DEADZONE) newState.right = true;
                }

                if (Math.abs(axes[GAMEPAD_AXIS_RIGHT_Y]) > DEADZONE) {
                    if (axes[GAMEPAD_AXIS_RIGHT_Y] < -DEADZONE) newState.up = true;
                    else if (axes[GAMEPAD_AXIS_RIGHT_Y] > DEADZONE) newState.down = true;
                }

                // Right stick fire
                if (gamepad.buttons.length > 6 && gamepad.buttons[6].pressed) {
                    newState.fire = true;
                }
            }
        }

        this.state = newState;
        return newState;
    }
}
