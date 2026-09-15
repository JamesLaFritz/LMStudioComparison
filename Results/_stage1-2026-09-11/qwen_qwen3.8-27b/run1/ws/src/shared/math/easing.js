// Pure easing curves. t is expected in [0, 1]; clamped defensively.

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

export const linear = (t) => clamp01(t);

export const easeOutCubic = (t) => {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
};

export const easeInCubic = (t) => {
  const x = clamp01(t);
  return x * x * x;
};

export const easeInOutCubic = (t) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export const easeOutQuad = (t) => {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x);
};

export const easeInQuad = (t) => {
  const x = clamp01(t);
  return x * x;
};

export const easeOutBack = (t) => {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export const easeOutExpo = (t) => {
  const x = clamp01(t);
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

export const easeOutElastic = (t) => {
  const x = clamp01(t);
  if (x === 0) return 0;
  if (x === 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
};

export const easeOutBounce = (t) => {
  let x = clamp01(t);
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75; }
  if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
  x -= 2.625 / d1;
  return n1 * x * x + 0.984375;
};
