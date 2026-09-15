import { vec3 } from '../shared/utils/math.js';

/**
 * Collision detection utilities for Space Invaders.
 * Supports AABB (axis-aligned bounding box) and circle-based hit detection.
 */

// ─── AABB Collision ────────────────────────────────────────────────

/**
 * Check if two axis-aligned rectangles overlap.
 * @param {number} ax - X position of first rectangle
 * @param {number} ay - Y position of first rectangle
 * @param {number} aw - Width of first rectangle
 * @param {number} ah - Height of first rectangle
 * @param {number} bx - X position of second rectangle
 * @param {number} by - Y position of second rectangle
 * @param {number} bw - Width of second rectangle
 * @param {number} bh - Height of second rectangle
 * @returns {boolean} True if rectangles overlap
 */
export function aabbCollides(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Check if two Three.js Box3D geometries overlap.
 * @param {THREE.Box3D} box1 - First box geometry
 * @param {THREE.Box3D} box2 - Second box geometry
 * @returns {boolean} True if boxes overlap
 */
export function boxCollides(box1, box2) {
  return aabbCollides(
    box1.position.x, box1.position.y, box1.geometry.width, box1.geometry.height,
    box2.position.x, box2.position.y, box2.geometry.width, box2.geometry.height
  );
}

// ─── Circle-Based Hit Detection ──────────────────────────────────────

/**
 * Check if a point is inside a circle.
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} cx - Circle center X
 * @param {number} cy - Circle center Y
 * @param {number} r  - Circle radius
 * @returns {boolean} True if point is inside circle
 */
export function pointInCircle(px, py, cx, cy, r) {
  const dx = px - cx;
  const dy = py - cy;
  return (dx * dx + dy * dy) < (r * r);
}

/**
 * Check if a projectile circle intersects an alien's hitbox.
 * @param {number} px - Projectile X position
 * @param {number} py - Projectile Y position
 * @param {number} pr - Projectile radius
 * @param {number} ax - Alien X position
 * @param {number} ay - Alien Y position
 * @param {number} ar - Alien hit radius
 * @returns {boolean} True if projectile hits alien
 */
export function projectileHitsAlien(px, py, pr, ax, ay, ar) {
  return pointInCircle(px, py, ax, ay, ar);
}

/**
 * Check if two circles intersect.
 * @param {number} cx1 - Center X of first circle
 * @param {number} cy1 - Center Y of first circle
 * @param {number} r1  - Radius of first circle
 * @param {number> cx2 - Center X of second circle
 * @param {number> cy2 - Center Y of second circle
 * @param {number> r2  - Radius of second circle
 * @returns {boolean} True if circles intersect
 */
export function circlesCollide(cx1, cy1, r1, cx2, cy2, r2) {
  const dx = cx1 - cx2;
  const dy = cy1 - cy2;
  return (dx * dx + dy * dy) < ((r1 + r2) * (r1 + r2));
}

// ─── Hit Radius Configuration ──────────────────────────────────────

/**
 * Returns the hit radius for a given alien type.
 * Larger aliens have larger hit radii for forgiving gameplay.
 * @param {string} type - Alien type: 'squid', 'crab', or 'octopus'
 * @returns {number} Hit radius in pixels
 */
export function getAlienHitRadius(type) {
  const radii = { squid: 12, crab: 9, octopus: 7 };
  return radii[type] || 8;
}

/**
 * Returns the visual width and height for a given alien type.
 * @param {string} type - Alien type
 * @returns {{width: number, height: number}} Dimensions in pixels
 */
export function getAlienDimensions(type) {
  const dims = { squid: { width: 24, height: 18 }, crab: { width: 20, height: 16 }, octopus: { width: 18, height: 14 } };
  return dims[type] || { width: 16, height: 12 };
}

/**
 * Returns the player hit radius.
 * @returns {number} Hit radius in pixels
 */
export function getPlayerHitRadius() {
  return 10;
}