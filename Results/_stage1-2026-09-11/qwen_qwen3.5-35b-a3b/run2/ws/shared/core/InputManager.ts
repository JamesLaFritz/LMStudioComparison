export class InputManager {
    private keys: Map<string, boolean> = new Map();
    private gamepadIndex: number | null = null;
    
    constructor() {
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        window.addEventListener('gamepadconnected', (e) => this.onGamepadConnected(e));
        window.addEventListener('gamepaddisconnected', (e) => this.onGamepadDisconnected(e));
    }

    private onKeyDown(event: KeyboardEvent): void {
        this.keys.set(event.code, true);
    }

    private onKeyUp(event: KeyboardEvent): void {
        this.keys.set(event.code, false);
    }

    private onGamepadConnected(event: GamepadEvent): void {
        this.gamepadIndex = event.gamepad.index;
    }

    private onGamepadDisconnected(): void {
        this.gamepadIndex = null;
    }

    public isKeyDown(code: string): boolean {
        return this.keys.get(code) || false;
    }

    public getAxis(axisName: string, deadzone: number = 0.15): number {
        // Check keyboard first
        if (axisName === 'left') {
            if (this.isKeyDown('ArrowLeft') || this.isKeyDown('KeyA')) return -1;
        } else if (axisName === 'right') {
            if (this.isKeyDown('ArrowRight') || this.isKeyDown('KeyD')) return 1;
        }

        // Check gamepad
        const gamepad = this.gamepadIndex !== null ? navigator.getGamepads()[this.gamepadIndex] : null;
        if (gamepad) {
            if (axisName === 'left') {
                const value = -gamepad.axes[0];
                return Math.abs(value) > deadzone ? value : 0;
            } else if (axisName === 'right') {
                const value = gamepad.axes[0];
                return Math.abs(value) > deadzone ? value : 0;
            }
        }

        return 0;
    }

    public isActionPressed(action: string): boolean {
        if (action === 'shoot') {
            // Keyboard
            if (this.isKeyDown('Space') || this.isKeyDown('Enter')) return true;
            
            // Gamepad
            const gamepad = this.gamepadIndex !== null ? navigator.getGamepads()[this.gamepadIndex] : null;
            if (gamepad && gamepad.buttons[0].pressed) return true;
        } else if (action === 'move') {
            return Math.abs(this.getAxis('left')) > 0 || Math.abs(this.getAxis('right')) > 0;
        }

        return false;
    }

    public getGamepad(): Gamepad | null {
        return this.gamepadIndex !== null ? navigator.getGamepads()[this.gamepadIndex] : null;
    }

    public hasGamepad(): boolean {
        return this.gamepadIndex !== null;
    }
}