/**
 * The object returned by DualInput.poll(). It is reused by the input service;
 * simulation should read it during the current frame rather than retain it.
 */
export function createInputFrame() {
  return {
    moveX: 0,
    left: false,
    right: false,
    fire: false,
    firePressed: false,
    confirmPressed: false,
    pausePressed: false,
    restartPressed: false,
    anyPressed: false,
    gamepadConnected: false,
  };
}

export function clearInputEdges(frame) {
  frame.firePressed = false;
  frame.confirmPressed = false;
  frame.pausePressed = false;
  frame.restartPressed = false;
  frame.anyPressed = false;
  return frame;
}
