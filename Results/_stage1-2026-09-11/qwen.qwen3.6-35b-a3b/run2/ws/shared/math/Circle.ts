import type { Vector3f } from '../types.js';

export function circleOverlap(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy <= (ar + br) * (ar + br);
}

export function circleToCircleNormal(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number
): { nx: number; ny: number } | null {
  const dx = bx - ax;
  const dy = by - ay;
  const distSq = dx * dx + dy * dy;
  const combinedR = ar + br;
  if (distSq >= combinedR * combinedR || distSq === 0) return null;
  const dist = Math.sqrt(distSq);
  return { nx: dx / dist, ny: dy / dist };
}

export function pointInCircle(px: number, py: number, cx: number, cy: number, r: number): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}
