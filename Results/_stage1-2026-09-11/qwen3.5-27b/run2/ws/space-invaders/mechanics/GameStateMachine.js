/**
 * GameStateMachine - Manages game state transitions for Space Invaders
 * States: MENU, PLAYING, PAUSED, LEVEL_COMPLETE, GAME_OVER
 */

export const GameStates = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    LEVEL_COMPLETE: 'LEVEL_COMPLETE',
    GAME_OVER: 'GAME_OVER'
};

export class GameStateMachine {
    constructor() {
        this.currentState = GameStates.MENU;
        this.previousState = null;
        this.stateCallbacks = new Map();
        this.enterCallbacks = new Map();
        this.exitCallbacks = new Map();
        
        // Initialize state callbacks
        this._initializeDefaultCallbacks();
    }

    _initializeDefaultCallbacks() {
        // MENU state
        this.enterCallbacks.set(GameStates.MENU, () => {
            console.log('Entered MENU state');
        });

        // PLAYING state
        this.enterCallbacks.set(GameStates.PLAYING, () => {
            console.log('Entered PLAYING state');
        });

        // PAUSED state
        this.enterCallbacks.set(GameStates.PAUSED, () => {
            console.log('Entered PAUSED state');
        });

        // LEVEL_COMPLETE state
        this.enterCallbacks.set(GameStates.LEVEL_COMPLETE, () => {
            console.log('Entered LEVEL_COMPLETE state');
        });

        // GAME_OVER state
        this.enterCallbacks.set(GameStates.GAME_OVER, () => {
            console.log('Entered GAME_OVER state');
        });
    }

    /**
     * Set the current game state with proper transition handling
     * @param {string} newState - The target state to transition to
     */
    setState(newState) {
        if (this.currentState === newState) return;

        const oldState = this.currentState;
        
        // Call exit callback for current state
        if (this.exitCallbacks.has(oldState)) {
            this.exitCallbacks.get(oldState)(newState);
        }

        // Save previous state and update current
        this.previousState = oldState;
        this.currentState = newState;

        // Call enter callback for new state
        if (this.enterCallbacks.has(newState)) {
            this.enterCallbacks.get(newState)(oldState);
        }

        console.log(`State transition: ${oldState} -> ${newState}`);
    }

    /**
     * Register a callback to be called when entering a specific state
     * @param {string} state - The state to listen for
     * @param {Function} callback - Function to call on state entry
     */
    onEnter(state, callback) {
        if (!this.enterCallbacks.has(state)) {
            this.enterCallbacks.set(state, []);
        }
        
        const callbacks = this.enterCallbacks.get(state);
        if (Array.isArray(callbacks)) {
            callbacks.push(callback);
        } else {
            this.enterCallbacks.set(state, [this.enterCallbacks.get(state), callback]);
        }
    }

    /**
     * Register a callback to be called when exiting a specific state
     * @param {string} state - The state to listen for
     * @param {Function} callback - Function to call on state exit
     */
    onExit(state, callback) {
        if (!this.exitCallbacks.has(state)) {
            this.exitCallbacks.set(state, []);
        }
        
        const callbacks = this.exitCallbacks.get(state);
        if (Array.isArray(callbacks)) {
            callbacks.push(callback);
        } else {
            this.exitCallbacks.set(state, [this.exitCallbacks.get(state), callback]);
        }
    }

    /**
     * Register a state-specific action callback
     * @param {string} state - The state to listen for
     * @param {Function} callback - Function to call while in this state
     */
    onState(state, callback) {
        if (!this.stateCallbacks.has(state)) {
            this.stateCallbacks.set(state, []);
        }
        
        const callbacks = this.stateCallbacks.get(state);
        if (Array.isArray(callbacks)) {
            callbacks.push(callback);
        } else {
            this.stateCallbacks.set(state, [this.stateCallbacks.get(state), callback]);
        }
    }

    /**
     * Execute state-specific action callbacks
     * @param {...any} args - Arguments to pass to the callbacks
     */
    executeStateActions(...args) {
        const callbacks = this.stateCallbacks.get(this.currentState);
        if (callbacks) {
            if (Array.isArray(callbacks)) {
                callbacks.forEach(cb => cb.apply(null, args));
            } else {
                callbacks.apply(null, args);
            }
        }
    }

    /**
     * Check if currently in a specific state
     * @param {string} state - The state to check
     * @returns {boolean} True if current state matches
     */
    isState(state) {
        return this.currentState === state;
    }

    /**
     * Get the current state
     * @returns {string} Current game state
     */
    getCurrentState() {
        return this.currentState;
    }

    /**
     * Get the previous state before current
     * @returns {string|null} Previous game state or null if none
     */
    getPreviousState() {
        return this.previousState;
    }

    /**
     * Check if the game is in an active playing state (not menu, not over)
     * @returns {boolean} True if PLAYING or LEVEL_COMPLETE
     */
    isPlaying() {
        return this.currentState === GameStates.PLAYING || 
               this.currentState === GameStates.LEVEL_COMPLETE;
    }

    /**
     * Check if the game is paused (input disabled)
     * @returns {boolean} True if PAUSED or LEVEL_COMPLETE
     */
    isPaused() {
        return this.currentState === GameStates.PAUSED || 
               this.currentState === GameStates.LEVEL_COMPLETE;
    }

    /**
     * Check if the game has ended (game over)
     * @returns {boolean} True if GAME_OVER state
     */
    isGameOver() {
        return this.currentState === GameStates.GAME_OVER;
    }

    /**
     * Reset the state machine to initial menu state
     */
    reset() {
        // Call exit callback for current state if exists
        if (this.exitCallbacks.has(this.currentState)) {
            const callbacks = this.exitCallbacks.get(this.currentState);
            if (Array.isArray(callbacks)) {
                callbacks.forEach(cb => cb(GameStates.MENU));
            } else {
                callbacks(GameStates.MENU);
            }
        }

        this.previousState = null;
        this.currentState = GameStates.MENU;

        // Call enter callback for MENU state
        if (this.enterCallbacks.has(GameStates.MENU)) {
            const callbacks = this.enterCallbacks.get(GameStates.MENU);
            if (Array.isArray(callbacks)) {
                callbacks.forEach(cb => cb(null));
            } else {
                callbacks(null);
            }
        }

        console.log('State machine reset to MENU');
    }

    /**
     * Transition back to the previous state (for unpausing)
     */
    restorePreviousState() {
        if (this.previousState && this.previousState !== GameStates.MENU) {
            this.setState(this.previousState);
        }
    }
}
