import { KeyboardController, MouseController } from 'three';

class InputHandler {
  constructor() {
    this.keyboard = new KeyboardController();
    this.mouse = new MouseController();
    this._boundKeyboard = false;
    this._boundMouse = false;
  }

  getInputs() {
    if (!this._boundKeyboard) {
      window.addEventListener('keydown', this.onKeyDown.bind(this));
      this._boundKeyboard = true;
    }
    if (!this._boundMouse) {
      window.addEventListener('mousemove', this.onMouseMove.bind(this));
      this._boundMouse = true;
    }
    return {
      left: () => this.keyboard.getKey('ArrowLeft'),
      right: () => this.keyboard.getKey('ArrowRight'),
      shoot: () => this.keyboard.getKey('Space'),
      mouseX: () => this.mouse.getX(),
      mouseY: () => this.mouse.getY()
    };
  }

  onKeyDown(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      this.keyboard.setDown('left');
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      this.keyboard.setDown('right');
    } else if (e.code === 'Space') {
      this.keyboard.setDown('shoot');
    }
  }

  onMouseMove(e) {
    this.mouse.setPosition(e.clientX, e.clientY);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    this._boundKeyboard = false;
    this._boundMouse = false;
  }
}

export default InputHandler;