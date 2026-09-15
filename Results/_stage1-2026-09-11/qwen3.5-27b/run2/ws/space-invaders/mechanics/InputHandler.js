/**
 * InputHandler - Unified Keyboard + Gamepad API Controller
 * Handles both input methods seamlessly with hot-swap support
 */

export class InputHandler {
    constructor() {
        this.keys = new Set();
        this.gamepads = [];
        
        // Input state
        this.leftPressed = false;
        this.rightPressed = false;
        this.firePressed = false;
        this.pausePressed = false;
        this.startPressed = false;
        
        // Fire cooldown tracking
        this.fireHeldDown = false;
        this.lastFireTime = 0;
        this.fireRate = 400; // ms between shots when holding
        
        // Gamepad state
        this.gamepadIndex = null;
        this.gamepadConnected = false;
        
        // Bind handlers
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.pollGamepads = this.pollGamepads.bind(this);
        
        // Setup listeners
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        
        // Gamepad connection events
        window.addEventListener('gamepadconnected', (e) => {
            console.log(`Gamepad connected: ${e.gamepad.id}`);
            this.gamepadIndex = e.gamepad.index;
            this.gamepadConnected = true;
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('Gamepad disconnected');
            if (this.gamepadIndex === e.gamepad.index) {
                this.gamepadIndex = null;
                this.gamepadConnected = false;
            }
        });
        
        // Start polling for gamepad state changes
        requestAnimationFrame(this.pollGamepads);
    }
    
    handleKeyDown(e) {
        const key = e.key.toLowerCase();
        
        // Prevent default for game keys to avoid scrolling etc.
        if (['arrowleft', 'arrowright', ' ', 'enter', 'escape', 'p'].includes(key)) {
            e.preventDefault();
        }
        
        this.keys.add(key);
        
        // Update input state from keyboard
        if (key === 'arrowleft' || key === 'a') {
            this.leftPressed = true;
        }
        if (key === 'arrowright' || key === 'd') {
            this.rightPressed = true;
        }
        if (key === ' ') {
            this.firePressed = true;
        }
        if (key === 'p' || key === 'escape') {
            this.pausePressed = true;
        }
        if (key === 'enter') {
            this.startPressed = true;
        }
    }
    
    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        this.keys.delete(key);
        
        // Update input state from keyboard
        if (key === 'arrowleft' || key === 'a') {
            this.leftPressed = false;
        }
        if (key === 'arrowright' || key === 'd') {
            this.rightPressed = false;
        }
        if (key === ' ') {
            this.firePressed = false;
            this.fireHeldDown = false;
        }
    }
    
    pollGamepads() {
        // Check all connected gamepads
        const gamepadList = navigator.getGamepads();
        
        for (let i = 0; i < gamepadList.length; i++) {
            const gp = gamepadList[i];
            if (gp) {
                this.updateFromGamepad(gp, i);
            }
        }
        
        // Continue polling
        requestAnimationFrame(this.pollGamepads);
    }
    
    updateFromGamepad(gamepad, index) {
        // Deadzone for analog sticks
        const deadzone = 0.2;
        
        // Get axes (left stick or D-pad)
        const leftAxis = gamepad.axes[0]; // Left stick X
        const rightAxis = gamepad.axes[1]; // Right stick Y
        
        // Get buttons
        const aButton = gamepad.buttons[0]; // A button / Cross
        const bButton = gamepad.buttons[1]; // B button / Circle
        const startButton = gamepad.buttons[9]; // Start
        const optionsButton = gamepad.buttons[8]; // Options/Select
        
        // Update movement from left stick or D-pad
        if (leftAxis < -deadzone) {
            this.leftPressed = true;
            this.rightPressed = false;
        } else if (leftAxis > deadzone) {
            this.rightPressed = true;
            this.leftPressed = false;
        }
        
        // D-pad support (buttons 12-15 typically)
        if (gamepad.buttons[14]?.pressed) { // Left on D-pad
            this.leftPressed = true;
            this.rightPressed = false;
        }
        if (gamepad.buttons[15]?.pressed) { // Right on D-pad
            this.rightPressed = true;
            this.leftPressed = false;
        }
        
        // Fire button (A/Cross or B/Circle)
        if (aButton.pressed || bButton.pressed) {
            this.firePressed = true;
        }
        
        // Pause/Options button
        if (optionsButton.pressed) {
            this.pausePressed = true;
        }
        
        // Start button
        if (startButton.pressed) {
            this.startPressed = true;
        }
    }
    
    /**
     * Check if fire should trigger this frame
     * Handles both tap and hold-to-fire behavior
     */
    canFire(currentFireRate = 400) {
        const now = performance.now();
        
        // If just pressed (not held), allow immediate fire
        if (this.firePressed && !this.fireHeldDown) {
            this.fireHeldDown = true;
            return true;
        }
        
        // If holding, check cooldown
        if (this.firePressed && this.fireHeldDown) {
            if (now - this.lastFireTime >= currentFireRate) {
                this.lastFireTime = now;
                return true;
            }
            return false;
        }
        
        return false;
    }
    
    /**
     * Get movement direction (-1 left, 0 none, 1 right)
     */
    getMovementDirection() {
        if (this.leftPressed && this.rightPressed) {
            return 0; // Cancel out
        }
        if (this.leftPressed) {
            return -1;
        }
        if (this.rightPressed) {
            return 1;
        }
        return 0;
    }
    
    /**
     * Check for pause toggle (single press detection)
     */
    checkPauseToggle() {
        const wasPaused = this.pausePressed;
        // This is checked each frame, so we need to detect the transition
        return wasPaused;
    }
    
    /**
     * Check for start/confirm action
     */
    checkStartAction() {
        return this.startPressed;
    }
    
    /**
     * Reset fire state (called on pause/menu)
     */
    resetFireState() {
        this.fireHeldDown = false;
        this.lastFireTime = 0;
    }
    
    /**
     * Set custom fire rate for power-ups
     */
    setFireRate(rate) {
        this.fireRate = Math.max(100, rate); // Minimum 100ms
    }
    
    /**
     * Get current input source for debugging
     */
    getInputSource() {
        if (this.gamepadConnected && this.gamepadIndex !== null) {
            return 'gamepad';
        }
        return 'keyboard';
    }
    
    cleanup() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }
}

export default InputHandler;
