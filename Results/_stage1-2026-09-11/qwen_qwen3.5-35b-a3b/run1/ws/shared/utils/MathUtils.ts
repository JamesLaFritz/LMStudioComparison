/**
 * Mathematical utilities for Space Invaders and other games.
 * Provides vector operations, collision detection, and randomization.
 */

export class MathUtils {
  /**
   * Linear interpolation between two values.
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Clamp a value between min and max.
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Generate a random integer between min and max (inclusive).
   */
  static randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate a random float between min and max.
   */
  static randFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Random unit vector in 2D.
   */
  static randomUnitVector2(): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.cos(angle),
      y: Math.sin(angle)
    };
  }

  /**
   * Random unit vector in 3D.
   */
  static randomUnitVector3(): { x: number; y: number; z: number } {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    return {
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.sin(phi) * Math.sin(theta),
      z: Math.cos(phi)
    };
  }

  /**
   * Distance squared between two points (avoids sqrt for performance).
   */
  static distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  /**
   * Distance between two points.
   */
  static distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(this.distanceSquared(x1, y1, x2, y2));
  }

  /**
   * Check if point is inside circle.
   */
  static pointInCircle(px: number, py: number, cx: number, cy: number, radius: number): boolean {
    return this.distanceSquared(px, py, cx, cy) <= radius * radius;
  }

  /**
   * Check if two circles collide.
   */
  static circleCollision(cx1: number, cy1: number, r1: number, cx2: number, cy2: number, r2: number): boolean {
    return this.distanceSquared(cx1, cy1, cx2, cy2) <= (r1 + r2) * (r1 + r2);
  }

  /**
   * Axis-Aligned Bounding Box collision detection.
   */
  static aabbCollision(
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number
  ): boolean {
    return !(x1 + w1 < x2 || x1 > x2 + w2 || y1 + h1 < y2 || y1 > y2 + h2);
  }

  /**
   * Smoothstep interpolation for smooth transitions.
   */
  static smoothStep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  /**
   * Map a value from one range to another.
   */
  static map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  }

  /**
   * Randomize array elements in place (Fisher-Yates shuffle).
   */
  static shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Generate a seeded random number for reproducible procedural generation.
   */
  static seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Convert degrees to radians.
   */
  static degToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees.
   */
  static radToDeg(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Calculate angle between two points.
   */
  static angleBetween(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1);
  }

  /**
   * Normalize an angle to be within [0, 2π).
   */
  static normalizeAngle(angle: number): number {
    let normalized = angle % (Math.PI * 2);
    if (normalized < 0) {
      normalized += Math.PI * 2;
    }
    return normalized;
  }

  /**
   * Get the shortest rotation direction between two angles.
   */
  static shortestRotationAngle(from: number, to: number): number {
    let diff = this.normalizeAngle(to - from);
    if (diff > Math.PI) {
      diff -= Math.PI * 2;
    } else if (diff < -Math.PI) {
      diff += Math.PI * 2;
    }
    return diff;
  }

  /**
   * Easing functions for smooth animations.
   */
  static easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  static easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  static easeInOutSine(t: number): number {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }
}