export const FP_SHIFT = 8;
export const FP_ONE = 1 << FP_SHIFT;

export function toFixed(value) {
  return Math.round(Number(value) * FP_ONE);
}

export function fromFixed(value) {
  return Number(value) / FP_ONE;
}

export function mulFixed(a, b) {
  return Math.trunc((Number(a) * Number(b)) / FP_ONE);
}

/** Quantize a normalized axis to signed int8, optionally applying cabinet deadzone. */
export function quantizeAxis(value, deadzone = 0) {
  const input = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
  const magnitude = Math.abs(input);
  if (magnitude <= deadzone) return 0;
  const remapped = deadzone > 0
    ? Math.pow((magnitude - deadzone) / (1 - deadzone), 1.35)
    : magnitude;
  return Math.max(-127, Math.min(127, Math.round(Math.sign(input) * remapped * 127)));
}
