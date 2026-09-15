export const keys = new Set();

window.addEventListener('keydown', e => {
  if (e.code === 'Key') keys.add(e.code);
});

window.addEventListener('keyup', e => {
  keys.delete(e.code);
});

let gamepad = null;

const updateGamepads = () => {
  const gps = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
  gamepad = gps.find((gp) => gp && (gp.id.includes('Xbox') || gp.id.includes('Dual')));
};

window.addEventListener('gamepadconnected', updateGamepads);
window.addEventListener('gamepaddisconnected', updateGamepads);
updateGamepads();

export function getAxis(axisIndex, deadzone = 0.15) {
  const axis = gamepad?.axes[axisIndex];
  return Math.abs(axis || 0) < deadzone ? 0 : axis;
}

export function getButton(buttonIndex) {
  return !!gamepad?.buttons[buttonIndex]?.pressed;
}