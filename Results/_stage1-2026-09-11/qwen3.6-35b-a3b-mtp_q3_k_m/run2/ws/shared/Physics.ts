import * as THREE from 'three';

export interface AABB {
    min: THREE.Vector3;
    max: THREE.Vector3;
}

/**
 * Axis-aligned bounding box intersection test.
 * Returns true if both boxes overlap on all three axes.
 */
export function aabbOverlap(a: AABB, b: AABB): boolean {
    return (
        a.min.x <= b.max.x && a.max.x >= b.min.x &&
        a.min.y <= b.max.y && a.max.y >= b.min.y &&
        a.min.z <= b.max.z && a.max.z >= b.min.z
    );
}

/**
 * Creates an AABB from a mesh's bounding box in world space.
 */
export function getWorldAABB(mesh: THREE.Object3D): AABB {
    const box = new THREE.Box3().setFromObject(mesh);
    return { min: box.min.clone(), max: box.max.clone() };
}

/**
 * Simple impulse-based collision response for 1D overlap along a given axis.
 * Returns the penetration depth (positive if overlapping).
 */
export function resolveOverlap(
    posA: THREE.Vector3,
    posB: THREE.Vector3,
    halfWidthA: number,
    halfWidthB: number,
    axis: 'x' | 'y' = 'x'
): number {
    const diff = Math.abs(posA[axis] - posB[axis]);
    const sumHalf = halfWidthA + halfWidthB;
    if (diff < sumHalf) {
        return sumHalf - diff; // penetration depth
    }
    return 0;
}

/**
 * Returns the collision normal direction for two AABBs.
 */
export function getCollisionNormal(a: AABB, b: AABB): THREE.Vector3 {
    const centerA = new THREE.Vector3().lerpVectors(a.min, a.max, 0.5);
    const centerB = new THREE.Vector3().lerpVectors(b.min, b.max, 0.5);
    const dir = new THREE.Vector3().subVectors(centerA, centerB).normalize();

    // Return the axis with smallest overlap
    const overlapX = Math.min(a.max.x - b.min.x, b.max.x - a.min.x);
    const overlapY = Math.min(a.max.y - b.min.y, b.max.y - a.min.y);
    const overlapZ = Math.min(a.max.z - b.min.z, b.max.z - a.min.z);

    if (overlapX <= overlapY && overlapX <= overlapZ) {
        dir.set(Math.sign(centerA.x - centerB.x), 0, 0);
    } else if (overlapY <= overlapZ) {
        dir.set(0, Math.sign(centerA.y - centerB.y), 0);
    } else {
        dir.set(0, 0, Math.sign(centerA.z - centerB.z));
    }

    return dir;
}
