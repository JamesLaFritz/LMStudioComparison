/**
 * Keyboard Controller - Handles keyboard input with deadzone filtering
 */
class KeyboardController {
    constructor() {
        this.keys = {};
        this.actions = {};
        this.deadzone = 0.1;

        document.addEventListener('keydown', (e) => {
            if (!this.keys[e.key]) {
                this.keys[e.key] = true;
                this._triggerAction(e.key);
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
            this._clearAction(e.key);
        });
    }

    _triggerAction(key) {
        const actionMap = {
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'w': 'left',
            'a': 'left',
            's': 'right',
            'd': 'right',
            ' ': 'fire',
            'Enter': 'start'
        };

        const action = actionMap[key.toLowerCase()];
        if (action) {
            this.actions[action] = true;
        }
    }

    _clearAction(key) {
        const actionMap = {
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'w': 'left',
            'a': 'left',
            's': 'right',
            'd': 'right',
            ' ': 'fire',
            'Enter': 'start'
        };

        const action = actionMap[key.toLowerCase()];
        if (action) {
            this.actions[action] = false;
        }
    }

    isActionActive(action) {
        return !!this.actions[action];
    }

    update() {
        Object.keys(this.actions).forEach(action => {
            if (Math.abs(this.actions[action]) < this.deadzone) {
                this.actions[action] = 0;
            }
        });
    }
}

export default KeyboardController;
