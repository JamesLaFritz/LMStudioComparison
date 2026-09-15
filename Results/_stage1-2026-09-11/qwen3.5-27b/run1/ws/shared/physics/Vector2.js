/**
 * Vector2 - 2D vector math utilities
 * Used for all 2D physics calculations in the game plane
 */

export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * Create a new Vector2 from values
   */
  static create(x = 0, y = 0) {
    return new Vector2(x, y);
  }

  /**
   * Create a copy of this vector
   */
  clone() {
    return new Vector2(this.x, this.y);
  }

  /**
   * Add another vector to this one (returns new vector)
   */
  add(other) {
    if (other instanceof Vector2) {
      return new Vector2(this.x + other.x, this.y + other.y);
    }
    return new Vector2(this.x + other, this.y + other);
  }

  /**
   * Subtract another vector from this one (returns new vector)
   */
  subtract(other) {
    if (other instanceof Vector2) {
      return new Vector2(this.x - other.x, this.y - other.y);
    }
    return new Vector2(this.x - other, this.y - other);
  }

  /**
   * Multiply by scalar (returns new vector)
   */
  multiply(scalar) {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  /**
   * Divide by scalar (returns new vector)
   */
  divide(scalar) {
    return new Vector2(this.x / scalar, this.y / scalar);
  }

  /**
   * Get the magnitude (length) of this vector
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Get squared magnitude (faster for comparisons)
   */
  lengthSquared() {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Normalize to unit length (returns new vector)
   */
  normalize() {
    const len = this.length();
    if (len === 0) {
      return new Vector2(0, 0);
    }
    return new Vector2(this.x / len, this.y / len);
  }

  /**
   * Get the angle of this vector in radians
   */
  angle() {
    return Math.atan2(this.y, this.x);
  }

  /**
   * Calculate distance to another point/vector
   */
  distanceTo(other) {
    if (other instanceof Vector2) {
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    // Assume other is a point object with x, y
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate squared distance (faster for comparisons)
   */
  distanceSquaredTo(other) {
    if (other instanceof Vector2) {
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      return dx * dx + dy * dy;
    }
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return dx * dx + dy * dy;
  }

  /**
   * Dot product with another vector
   */
  dot(other) {
    if (other instanceof Vector2) {
      return this.x * other.x + this.y * other.y;
    }
    return this.x * other.x + this.y * other.y;
  }

  /**
   * Cross product magnitude (for 2D, returns scalar)
   */
  cross(other) {
    if (other instanceof Vector2) {
      return this.x * other.y - this.y * other.x;
    }
    return this.x * other.y - this.y * other.x;
  }

  /**
   * Lerp towards another vector
   */
  lerp(other, t) {
    if (other instanceof Vector2) {
      return new Vector2(
        this.x + (other.x - this.x) * t,
        this.y + (other.y - this.y) * t
      );
    }
    return new Vector2(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t
    );
  }

  /**
   * Clamp this vector to a rectangle bounds
   */
  clamp(minX, maxX, minY, maxY) {
    return new Vector2(
      Math.max(minX, Math.min(maxX, this.x)),
      Math.max(minY, Math.min(maxY, this.y))
    );
  }

  /**
   * Set values from another vector or values
   */
  set(x, y) {
    if (x instanceof Vector2) {
      this.x = x.x;
      this.y = x.y;
    } else {
      this.x = x;
      this.y = y !== undefined ? y : x;
    }
    return this;
  }

  /**
   * Zero out the vector
   */
  zero() {
    this.x = 0;
    this.y = 0;
    return this;
  }

  /**
   * Negate the vector (returns new vector)
   */
  negate() {
    return new Vector2(-this.x, -this.y);
  }

  /**
   * Scale to a specific length
   */
  scaleToLength(length) {
    const currentLen = this.length();
    if (currentLen === 0) {
      return new Vector2(0, 0);
    }
    const scale = length / currentLen;
    return new Vector2(this.x * scale, this.y * scale);
  }

  /**
   * Rotate by angle in radians (returns new vector)
   */
  rotate(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  /**
   * Check if approximately equal to another vector
   */
  equals(other, epsilon = 0.0001) {
    if (other instanceof Vector2) {
      return Math.abs(this.x - other.x) < epsilon && 
             Math.abs(this.y - other.y) < epsilon;
    }
    return Math.abs(this.x - other.x) < epsilon && 
           Math.abs(this.y - other.y) < epsilon;
  }

  /**
   * String representation for debugging
   */
  toString() {
    return `Vector2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }
}

/**
 * Convenience function to create a vector from an object with x, y properties
 */
export function vec2(obj) {
  return new Vector2(obj.x || 0, obj.y || 0);
}
