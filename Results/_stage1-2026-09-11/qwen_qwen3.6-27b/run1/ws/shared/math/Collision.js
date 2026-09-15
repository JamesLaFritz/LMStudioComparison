import { vec2, vec3 } from './VectorMath.js';

/**
 * Axis-Aligned Bounding Box
 * @typedef {Object} AABB
 * @property {number} minX
 * @property {number} minY
 * @property {number} minZ
 * @property {number} maxX
 * @property {number} maxY
 * @property {number} maxZ
 */

/**
 * Circle (2D)
 * @typedef {Object} Circle
 * @property {number} cx
 * @property {number} cy
 * @property {number} radius
 */

/**
 * Sphere (3D)
 * @typedef {Object} Sphere
 * @property {number} cx
 * @property {number} cy
 * @property {number} cz
 * @property {number} radius
 */

/**
 * Collision result
 * @typedef {Object} HitResult
 * @property {boolean} hit
 * @property {number} [nx] normal X
 * @property {number} [ny] normal Y
 * @property {number} [nz] normal Z
 * @property {number} [depth] penetration depth
 * @property {number} [px] contact point X
 * @property {number} [py] contact point Y
 * @property {number} [pz] contact point Z
 */

export function aabb(aMinX, aMinY, aMinZ, aMaxX, aMaxY, aMaxZ) {
    return { minX: aMinX, minY: aMinY, minZ: aMinZ, maxX: aMaxX, maxY: aMaxY, maxZ: aMaxZ };
}

export function aabbFromCenter(cx, cy, cz, hw, hh, hd) {
    return aabb(cx - hw, cy - hh, cz - hd, cx + hw, cy + hh, cz + hd);
}

export function aabbExpand(aabb, dx, dy, dz) {
    return aabb(
        aabb.minX - dx, aabb.minY - dy, aabb.minZ - dz,
        aabb.maxX + dx, aabb.maxY + dy, aabb.maxZ + dz
    );
}

/** AABB vs AABB — returns { hit, nx, ny, nz, depth } */
export function aabbVsAabb(a, b) {
    const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const oy = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
    const oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);

    if (ox <= 0 || oy <= 0 || oz <= 0) return { hit: false };

    // Find minimum penetration axis
    if (ox < oy && ox < oz) {
        const depth = ox;
        const nx = (a.minX + a.maxX) < (b.minX + b.maxX) ? -1 : 1;
        const cx = (a.maxX + b.minX) / 2;
        const cy = (Math.max(a.minY, b.minY) + Math.min(a.maxY, b.maxY)) / 2;
        const cz = (Math.max(a.minZ, b.minZ) + Math.min(a.maxZ, b.maxZ)) / 2;
        return { hit: true, nx, ny: 0, nz: 0, depth, px: cx, py: cy, pz: cz };
    } else if (oy < oz) {
        const depth = oy;
        const ny = (a.minY + a.maxY) < (b.minY + b.maxY) ? -1 : 1;
        const cx = (Math.max(a.minX, b.minX) + Math.min(a.maxX, b.maxX)) / 2;
        const cy = (a.maxY + b.minY) / 2;
        const cz = (Math.max(a.minZ, b.minZ) + Math.min(a.maxZ, b.maxZ)) / 2;
        return { hit: true, nx: 0, ny, nz: 0, depth, px: cx, py: cy, pz: cz };
    } else {
        const depth = oz;
        const nz = (a.minZ + a.maxZ) < (b.minZ + b.maxZ) ? -1 : 1;
        const cx = (Math.max(a.minX, b.minX) + Math.min(a.maxX, b.maxX)) / 2;
        const cy = (Math.max(a.minY, b.minY) + Math.min(a.maxY, b.maxY)) / 2;
        const cz = (a.maxZ + b.minZ) / 2;
        return { hit: true, nx: 0, ny: 0, nz, depth, px: cx, py: cy, pz: cz };
    }
}

/** Circle vs Circle (2D) */
export function circleVsCircle(a, b) {
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const distSq = dx * dx + dy * dy;
    const radii = a.radius + b.radius;

    if (distSq >= radii * radii || distSq === 0) return { hit: false };

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const depth = radii - dist;
    const px = a.cx + nx * a.radius;
    const py = a.cy + ny * a.radius;

    return { hit: true, nx, ny, depth, px, py };
}

/** AABB vs Circle (2D) — treats AABB as 2D box */
export function aabbVsCircle(box, circle) {
    // Find closest point on AABB to circle center
    const closestX = Math.max(box.minX, Math.min(circle.cx, box.maxX));
    const closestY = Math.max(box.minY, Math.min(circle.cy, box.maxY));

    const dx = circle.cx - closestX;
    const dy = circle.cy - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq >= circle.radius * circle.radius) return { hit: false };

    if (distSq === 0) {
        // Circle center is inside AABB — push out on shortest axis
        const halfW = (box.maxX - box.minX) / 2;
        const halfH = (box.maxY - box.minY) / 2;
        const cx = (box.minX + box.maxX) / 2;
        const cy = (box.minY + box.maxY) / 2;
        const dx2 = circle.cx - cx;
        const dy2 = circle.cy - cy;
        if (Math.abs(dx2) * halfH > Math.abs(dy2) * halfW) {
            const nx = dx2 > 0 ? 1 : -1;
            return { hit: true, nx, ny: 0, depth: circle.radius, px: closestX, py: closestY };
        } else {
            const ny = dy2 > 0 ? 1 : -1;
            return { hit: true, nx: 0, ny, depth: circle.radius, px: closestX, py: closestY };
        }
    }

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const depth = circle.radius - dist;

    return { hit: true, nx, ny, depth, px: closestX, py: closestY };
}

/** Ray vs AABB — ray origin (ox,oy,oz), direction (dx,dy,dz) */
export function rayVsAabb(ox, oy, oz, dx, dy, dz, box) {
    let tMin = -Infinity;
    let tMax = Infinity;

    // X slab
    if (Math.abs(dx) < 1e-10) {
        if (ox < box.minX || ox > box.maxX) return { hit: false };
    } else {
        let t1 = (box.minX - ox) / dx;
        let t2 = (box.maxX - ox) / dx;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return { hit: false };
    }

    // Y slab
    if (Math.abs(dy) < 1e-10) {
        if (oy < box.minY || oy > box.maxY) return { hit: false };
    } else {
        let t1 = (box.minY - oy) / dy;
        let t2 = (box.maxY - oy) / dy;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return { hit: false };
    }

    // Z slab
    if (Math.abs(dz) < 1e-10) {
        if (oz < box.minZ || oz > box.maxZ) return { hit: false };
    } else {
        let t1 = (box.minZ - oz) / dz;
        let t2 = (box.maxZ - oz) / dz;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return { hit: false };
    }

    if (tMin < 0) return { hit: false };

    const px = ox + dx * tMin;
    const py = oy + dy * tMin;
    const pz = oz + dz * tMin;

    return { hit: true, depth: tMin, px, py, pz };
}

/** Ray vs Sphere */
export function rayVsSphere(ox, oy, oz, dx, dy, dz, sphere) {
    const sx = ox - sphere.cx;
    const sy = oy - sphere.cy;
    const sz = oz - sphere.cz;

    const a = dx * dx + dy * dy + dz * dz;
    const b = 2 * (sx * dx + sy * dy + sz * dz);
    const c = sx * sx + sy * sy + sz * sz - sphere.radius * sphere.radius;

    const disc = b * b - 4 * a * c;
    if (disc < 0) return { hit: false };

    const sqrtDisc = Math.sqrt(disc);
    let t = (-b - sqrtDisc) / (2 * a);
    if (t < 0) t = (-b + sqrtDisc) / (2 * a);
    if (t < 0) return { hit: false };

    const px = ox + dx * t;
    const py = oy + dy * t;
    const pz = oz + dz * t;
    const nx = (px - sphere.cx) / sphere.radius;
    const ny = (py - sphere.cy) / sphere.radius;
    const nz = (pz - sphere.cz) / sphere.radius;

    return { hit: true, nx, ny, nz, depth: t, px, py, pz };
}

/** Line segment vs line segment (2D) — returns intersection point or null */
export function lineVsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
    }
    return null;
}

/** Point in AABB (2D) */
export function pointInAABB2(px, py, box) {
    return px >= box.minX && px <= box.maxX && py >= box.minY && py <= box.maxY;
}

/** Clamp value to range */
export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/** Linear interpolation */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/** Smoothstep */
export function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

/** Random float in [min, max) */
export function randRange(min, max) {
    return min + Math.random() * (max - min);
}

/** Random integer in [min, max] inclusive */
export function randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}
