// Unified Dual Input Controller: Keyboard + Gamepad API

export class InputController {
    constructor() {
        this.keys = {};
        this.gamepads = [];
        this.activeGamepadIndex = -1;
        
        // Input state
        this.left = false;
        this.right = false;
        this.fire = false;
        
        // Bind events
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.updateFromKeyboard();
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.updateFromKeyboard();
        });
        
        // Gamepad events
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad connected:', e.gamepad);
            this.updateGamepads();
        });
        
        window.addEventListener('gamepaddisconnected', () => {
            this.updateGamepads();
        });
    }
    
    updateFromKeyboard() {
        // WASD or Arrow keys for horizontal movement
        this.left = this.keys['KeyA'] || this.keys['ArrowLeft'];
        this.right = this.keys['KeyD'] || this.keys['ArrowRight'];
        
        // Space bar to fire
        this.fire = this.keys['Space'];
    }
    
    updateGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        this.gamepads = Array.from(gamepads);
        
        if (this.gamepads.length > 0) {
            this.activeGamepadIndex = 0;
        } else {
            this.activeGamepadIndex = -1;
        }
    }
    
    update() {
        // Update gamepad state every frame
        this.updateGamepads();
        
        if (this.activeGamepadIndex >= 0) {
            const gamepad = this.gamepads[this.activeGamepadIndex];
            
            // D-pad or left stick for horizontal movement
            this.left = gamepad.buttons[14].pressed || gamepad.axes[0] < -0.5;
            this.right = gamepad.buttons[15].pressed || gamepad.axes[0] > 0.5;
            
            // Button A (index 0) or B to fire
            this.fire = gamepad.buttons[0].pressed || gamepad.buttons[1].pressed;
        } else {
            // Fall back to keyboard if no gamepad
            this.updateFromKeyboard();
        }
    }
    
    getHorizontalInput() {
        return (this.right ? 1 : 0) - (this.left ? 1 : 0);
    }
}
