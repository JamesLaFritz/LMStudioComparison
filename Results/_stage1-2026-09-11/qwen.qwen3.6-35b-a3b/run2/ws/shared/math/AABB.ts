import * as THREE from 'three';
import type { BBox, Vector3f } from '../types.js';

export function createAABB(
  x: number, y: number, w: number, h: number
): BBox {
  return { minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2 };
}

export function aabbOverlap(a: BBox, b: BBox): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

export function boxContainsPoint(box: BBox, px: number, py: number): boolean {
  return px >= box.minX && px <= box.maxX && py >= box.minY && py <= box.maxY;
}

export function worldToBBox(obj: THREE.Object3D, halfW: number, halfH: number): BBox {
  const pos = obj.position;
  return createAABB(pos.x, pos.y, halfW * 2, halfH * 2);
}

export function bBoxToWorld(box: BBox): Vector3f {
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2, z: 0 };
}