/**
 * Shared utility functions for Three.js resource management and timing
 */

/**
 * Safely dispose of a Three.js object and its children
 * @param {THREE.Object3D} obj - The object to dispose
 * @param {boolean} removeFromParent - Whether to remove from scene graph
 */
export function disposeThreeJSObject(obj, removeFromParent = true) {
  if (!obj) return;

  // Dispose geometry and material
  if (obj.geometry) {
    obj.geometry.dispose();
    obj.geometry = null;
  }

  if (obj.material) {
    if (Array.isArray(obj.material)) {
      obj.material.forEach(mat => {
        if (mat.map) {
          mat.map.dispose();
          mat.map = null;
        }
        mat.dispose();
      });
    } else {
      if (obj.material.map) {
        obj.material.map.dispose();
        obj.material.map = null;
      }
      obj.material.dispose();
    }
    obj.material = null;
  }

  // Dispose texture directly if object has it
  if (obj.texture) {
    obj.texture.dispose();
    obj.texture = null;
  }

  // Recursively dispose children
  if (obj.children && obj.children.length > 0) {
    for (let i = obj.children.length - 1; i >= 0; i--) {
      const child = obj.children[i];
      disposeThreeJSObject(child, false);
    }
    obj.children = [];
  }

  // Remove from parent if requested
  if (removeFromParent && obj.parent) {
    obj.parent.remove(obj);
  }
}

/**
 * Dispose of a geometry and material pair
 */
export function disposeGeometryAndMaterial(geometry, material) {
  if (geometry) {
    geometry.dispose();
  }
  if (material) {
    if (material.map) {
      material.map.dispose();
    }
    material.dispose();
  }
}

/**
 * High-resolution timer wrapper
 */
export class Timer {
  constructor() {
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.elapsed = 0;
  }

  reset() {
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.elapsed = 0;
  }

  update() {
    const now = performance.now();
    const delta = (now - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = now;
    this.elapsed += delta;
    return delta;
  }

  getElapsedTime() {
    return (performance.now() - this.startTime) / 1000;
  }

  getDelta() {
    return (performance.now() - this.lastTime) / 1000;
  }
}

/**
 * Frame counter for game logic
 */
export class FrameCounter {
  constructor(fps = 60) {
    this.fps = fps;
    this.frameInterval = 1 / fps;
    this.accumulator = 0;
    this.currentFrame = 0;
  }

  update(dt) {
    this.accumulator += dt;
    
    while (this.accumulator >= this.frameInterval) {
      this.accumulator -= this.frameInterval;
      this.currentFrame++;
      return true; // New frame ready
    }
    
    return false;
  }

  reset() {
    this.accumulator = 0;
    this.currentFrame = 0;
  }
}

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Smooth step interpolation (Hermite curve)
 */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Random float in range [min, max]
 */
export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Random integer in range [min, max] inclusive
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random element from an array
 */
export function randomChoice(array) {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Check if value is within range (inclusive)
 */
export function inRange(value, min, max) {
  return value >= min && value <= max;
}

/**
 * Normalize a value from one range to another [0, 1]
 */
export function normalize(value, min, max) {
  return (value - min) / (max - min);
}

/**
 * Map a value from one range to another
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  const normalized = normalize(value, inMin, inMax);
  return outMin + normalized * (outMax - outMin);
}

/**
 * Debounce a function call
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle a function call
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Sleep for specified milliseconds (Promise-based)
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
