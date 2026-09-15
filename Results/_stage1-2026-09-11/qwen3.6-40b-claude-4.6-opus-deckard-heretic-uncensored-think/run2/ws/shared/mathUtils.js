// Math Utilities for Space Invaders
export function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

export function lerp(start, end, t) {
    return start + (end - start) * t;
}

export function easeInOut(t) {
    return 1 - Math.pow(1 - t, 3);}

export function easeOut(t) {
    return 1 - Math.pow(1 - t, 2);}

export function random(min = 0, max = 1) {
    return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
    return Math.floor(random(min, max));
}

export function map(value, inMin, inMax, outMin, outMax) {
    const rangeIn = inMax - inMin;
    const rangeOut = outMax - outMin;
    return (value - inMin) * rangeOut / rangeIn + outMin;
}

// Vector3 operations
export function vec2(x = 0, y = 0) {
    return { x, y };
}

export function vec3(x = 0, y = 0, z = 0) {
    return { x, y, z };
}

export function addVec2(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}

export function subVec2(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function scaleVec2(v, s) {
    return { x: v.x * s, y: v.y * s };
}

export function lengthSqVec2(v) {
    return v.x * v.x + v.y * v.y;
}

export function normalizeVec2(v) {
    const len = Math.sqrt(lengthSqVec2(v));
    if (len === 0) return vec2(1, 0);
    return { x: v.x / len, y: v.y / len };
}

// Easing functions for animations
export function easeInOutQuad(t) {
    t /= 0.5;
    if (t < 1) return 0.5 * t * t;
    --t;
    return -0.5 * (t * t - 2);}

export function easeOutBack(t) {
    const c3 = 1.70185;
    return 1 + Math.sin((t - 1) * c3) * Math.exp(-c3 * 4);}

