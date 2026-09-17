import { InputManager } from '../../shared/core/InputManager.js';

const KEY_BINDINGS = {
  moveLeft: ['ArrowLeft', 'KeyA'],
  moveRight: ['ArrowRight', 'KeyD'],
  fire: ['Space', 'KeyJ'],
  pause: ['Escape', 'KeyP']
};

export function createInputManager() {
  return new InputManager(KEY_BINDINGS);
}

/** Small readability facade over InputManager's generic action API. */
export const InputBindings = {
  getMoveAxis(inputManager) {
    return inputManager.axisX;
  },
  isFireHeld(inputManager) {
    return inputManager.isHeld('fire');
  },
  wasFirePressed(inputManager) {
    return inputManager.wasPressed('fire');
  },
  wasFireReleased(inputManager) {
    return inputManager.wasReleased('fire');
  },
  wasPausePressed(inputManager) {
    return inputManager.wasPressed('pause');
  }
};
