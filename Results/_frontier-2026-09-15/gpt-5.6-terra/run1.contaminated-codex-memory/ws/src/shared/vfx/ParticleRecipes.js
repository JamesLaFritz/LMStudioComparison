const RECIPES = {
  'player-fired': { count: 5, color: 0x5cf6ff, spread: 0.16, speed: 4.5, life: 0.18, priority: 30 },
  'bunker-hit': { count: 8, color: 0x83a2be, spread: 0.45, speed: 3.1, life: 0.42, priority: 35 },
  'invader-hit': { count: 18, color: 0xff63df, spread: 0.9, speed: 6.8, life: 0.62, priority: 60 },
  'ufo-hit': { count: 56, color: 0xffcf5c, spread: 1.4, speed: 9, life: 0.9, priority: 85 },
  'player-hit': { count: 100, color: 0x5cf6ff, spread: 1.7, speed: 10, life: 1.08, priority: 100 },
  'wave-clear': { count: 52, color: 0x85f7ff, spread: 1.9, speed: 7, life: 0.95, priority: 84 },
  victory: { count: 110, color: 0xffd66b, spread: 2.6, speed: 9.5, life: 1.35, priority: 100 },
};

export function particleRecipeFor(event = {}) {
  const base = RECIPES[event.type] ?? null;
  if (!base) return null;
  const power = Math.max(0.5, Math.min(2.2, Number(event.power) || 1));
  return {
    ...base,
    count: Math.min(120, Math.round(base.count * Math.min(1.35, power))),
    speed: base.speed * Math.sqrt(power),
    x: Number(event.x) || 0,
    y: Number(event.y) || 0,
    z: Number(event.z) || 0,
  };
}

export function impactPriority(event = {}) {
  return particleRecipeFor(event)?.priority ?? 0;
}
