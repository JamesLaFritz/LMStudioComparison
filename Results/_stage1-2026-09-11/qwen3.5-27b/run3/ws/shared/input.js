// Shared Input Controller - Unified Keyboard + Gamepad API
export class InputController {
  constructor() {
    this.keys = new Set();
    this.gamepads = [];
    this.actions = {
      left: false,
      right: false,
      shoot: false,
      shootPressed: false, // Edge detection for single-frame triggers
      menuUp: false,
      menuDown: false,
      confirm: false,
      confirmPressed: false,
    };

    this.gamepadIndices = new Set();
    
    this.setupKeyboardListeners();
    this.startGamepadPolling();
  }

  setupKeyboardListeners() {
    const keyMap = {
      // WASD
      'KeyA': 'left',
      'KeyD': 'right',
      'Space': 'shoot',
      // Arrows
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'Enter': 'confirm',
      // Menu navigation
      'ArrowUp': 'menuUp',
      'ArrowDown': 'menuDown',
    };

    document.addEventListener('keydown', (e) => {
      if (keyMap[e.code]) {
        const action = keyMap[e.code];
        this.keys.add(e.code);
        
        // Edge detection for shoot/confirm
        if (action === 'shoot' || action === 'confirm') {
          this.actions[`${action}Pressed`] = true;
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      if (keyMap[e.code]) {
        const action = keyMap[e.code];
        this.keys.delete(e.code);
        
        // Reset edge detection
        if (action === 'shoot' || action === 'confirm') {
          this.actions[`${action}Pressed`] = false;
        }
      }
    });
  }

  startGamepadPolling() {
    // Poll gamepads every frame via requestAnimationFrame
    const poll = () => {
      this.updateGamepads();
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);

    // Listen for connection/disconnection events
    window.addEventListener('gamepadconnected', (e) => {
      console.log(`Gamepad connected: ${e.gamepad.id}`);
      this.gamepadIndices.add(e.gamepad.index);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log(`Gamepad disconnected: ${e.gamepad.index}`);
      this.gamepadIndices.delete(e.gamepad.index);
    });
  }

  updateGamepads() {
    // Update gamepad array from navigator
    const newGamepads = [];
    for (let i = 0; i < navigator.getGamepads().length; i++) {
      const gp = navigator.getGamepads()[i];
      if (gp) {
        newGamepads.push(gp);
        this.gamepadIndices.add(i);
      }
    }

    // Remove disconnected gamepads
    for (const idx of this.gamepadIndices) {
      const found = navigator.getGamepads()[idx];
      if (!found) {
        this.gamepadIndices.delete(idx);
      }
    }

    this.gamepads = newGamepads;
  }

  update() {
    // Reset edge detection flags each frame
    this.actions.shootPressed = false;
    this.actions.confirmPressed = false;

    // Combine keyboard and gamepad input
    let left = false, right = false, shoot = false, confirm = false, menuUp = false, menuDown = false;

    // Keyboard input
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) left = true;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) right = true;
    if (this.keys.has('Space')) shoot = true;
    if (this.keys.has('Enter')) { confirm = true; this.actions.confirmPressed = true; }
    if (this.keys.has('ArrowUp')) menuUp = true;
    if (this.keys.has('ArrowDown')) menuDown = true;

    // Gamepad input (priority to first connected gamepad)
    for (const gp of this.gamepads) {
      const deadzone = 0.15;
      
      // Left stick or D-pad for movement
      const axisX = gp.axes[0];
      if (axisX < -deadzone) left = true;
      else if (axisX > deadzone) right = true;

      // D-pad buttons (buttons 12, 13, 14, 15 on most gamepads)
      if (gp.buttons[14]?.pressed) left = true;
      if (gp.buttons[15]?.pressed) right = true;

      // A button (0) or X button (cross) for shoot/confirm
      if (gp.buttons[0]?.pressed || gp.buttons[8]?.pressed) {
        shoot = true;
        confirm = true;
        this.actions.shootPressed = true;
        this.actions.confirmPressed = true;
      }

      // D-pad up/down for menu navigation
      if (gp.buttons[12]?.pressed) menuUp = true;
      if (gp.buttons[13]?.pressed) menuDown = true;
    }

    // Store combined state
    this.actions.left = left;
    this.actions.right = right;
    this.actions.shoot = shoot;
    this.actions.confirm = confirm;
    this.actions.menuUp = menuUp;
    this.actions.menuDown = menuDown;
  }

  isLeft() { return this.actions.left; }
  isRight() { return this.actions.right; }
  isShoot() { return this.actions.shoot; }
  isShootPressed() { return this.actions.shootPressed; }
  isConfirm() { return this.actions.confirm; }
  isConfirmPressed() { return this.actions.confirmPressed; }
  isMenuUp() { return this.actions.menuUp; }
  isMenuDown() { return this.actions.menuDown; }

  hasGamepad() {
    return this.gamepads.length > 0;
  }

  getConnectedGamepadCount() {
    return this.gamepads.length;
  }

  destroy() {
    // Clean up listeners if needed (document listeners are typically fine to leave)
    this.keys.clear();
    this.gamepads = [];
    this.gamepadIndices.clear();
  }
}

export default InputController;
