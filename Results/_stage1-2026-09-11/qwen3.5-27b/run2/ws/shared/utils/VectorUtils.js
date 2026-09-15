/**
 * VectorUtils - 3D Math Extensions for Space Invaders
 * Provides common vector operations and utility functions
 */

import * as THREE from 'three';

export class VectorUtils {
    /**
     * Clamp a vector component-wise to min/max bounds
     */
    static clamp(vector, minVec, maxVec) {
        return new THREE.Vector3(
            Math.max(minVec.x, Math.min(maxVec.x, vector.x)),
            Math.max(minVec.y, Math.min(maxVec.y, vector.y)),
            Math.max(minVec.z, Math.min(maxVec.z, vector.z))
        );
    }

    /**
     * Lerp between two vectors with t in [0, 1]
     */
    static lerp(start, end, t) {
        return new THREE.Vector3(
            start.x + (end.x - start.x) * t,
            start.y + (end.y - start.y) * t,
            start.z + (end.z - start.z) * t
        );
    }

    /**
     * Smooth lerp using Hermite curve for natural easing
     */
    static smoothLerp(start, end, t) {
        const smoothT = t * t * (3 - 2 * t);
        return this.lerp(start, end, smoothT);
    }

    /**
     * Rotate a vector around an axis by angle (radians)
     */
    static rotateAround(vector, center, axis, angle) {
        const rotated = vector.clone().sub(center);
        rotated.applyAxisAngle(axis, angle);
        return rotated.add(center);
    }

    /**
     * Get distance squared between two vectors (faster than distance for comparisons)
     */
    static distanceSquared(v1, v2) {
        const dx = v1.x - v2.x;
        const dy = v1.y - v2.y;
        const dz = v1.z - v2.z;
        return dx * dx + dy * dy + dz * dz;
    }

    /**
     * Normalize vector with fallback for zero vectors
     */
    static safeNormalize(vector) {
        const length = vector.length();
        if (length > 0.0001) {
            return vector.clone().normalize();
        }
        return new THREE.Vector3(0, 0, 0);
    }

    /**
     * Project a 3D point onto a plane defined by normal and a point on the plane
     */
    static projectOntoPlane(point, planeNormal, planePoint) {
        const direction = point.clone().sub(planePoint);
        const distance = direction.dot(planeNormal);
        return point.clone().sub(planeNormal.clone().multiplyScalar(distance));
    }

    /**
     * Get a random vector within a sphere of given radius
     */
    static randomInSphere(radius) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = radius * Math.cbrt(Math.random());

        return new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
    }

    /**
     * Get a random vector within a cone (direction is center, spread in radians)
     */
    static randomInCone(direction, spread, length = 1) {
        const axis = direction.clone().normalize();
        const perpX = new THREE.Vector3(0, 0, 1).cross(axis).normalize();
        if (perpX.lengthSq() === 0) {
            perpX.set(1, 0, 0).cross(axis).normalize();
        }
        const perpY = axis.clone().cross(perpX);

        const angle = Math.random() * spread * 2 - spread;
        const t = Math.random() * spread * 0.5;

        return new THREE.Vector3(
            axis.x + perpX.x * Math.sin(angle) + perpY.x * Math.sin(t),
            axis.y + perpX.y * Math.sin(angle) + perpY.y * Math.sin(t),
            axis.z + perpX.z * Math.sin(angle) + perpY.z * Math.sin(t)
        ).normalize().multiplyScalar(length);
    }

    /**
     * Check if vector is within viewport frustum (simplified)
     */
    static isInFrustum(vector, camera, near = 0.1, far = 100) {
        const viewVector = vector.clone().sub(camera.position);
        const distance = viewVector.length();
        
        if (distance < near || distance > far) return false;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

        viewVector.normalize();
        
        const fov = camera.fov * Math.PI / 180;
        const aspect = camera.aspect;
        
        const dotForward = viewVector.dot(forward);
        if (dotForward < Math.cos(fov / 2)) return false;

        const dotRight = Math.abs(viewVector.dot(right));
        const dotUp = Math.abs(viewVector.dot(up));
        
        const maxRight = Math.tan(fov / 2);
        const maxUp = maxRight / aspect;

        return dotRight < maxRight && dotUp < maxUp;
    }

    /**
     * Get screen space position from world vector
     */
    static toScreenSpace(vector, camera) {
        const screenPosition = vector.clone().project(camera);
        return new THREE.Vector2(
            (screenPosition.x + 1) / 2,
            (screenPosition.y + 1) / 2
        );
    }

    /**
     * Interpolate between two vectors using Catmull-Rom spline
     */
    static catmullRom(p0, p1, p2, p3, t) {
        const tt = t * t;
        const ttt = tt * t;

        const v0 = (-0.5 * p0.x + 1.5 * p1.x - 1.5 * p2.x + 0.5 * p3.x) * ttt +
                   (p0.x - 2.5 * p1.x + 2 * p2.x - 0.5 * p3.x) * tt +
                   (-0.5 * p0.x + 0.5 * p2.x) * t + p1.x;

        const v1 = (-0.5 * p0.y + 1.5 * p1.y - 1.5 * p2.y + 0.5 * p3.y) * ttt +
                   (p0.y - 2.5 * p1.y + 2 * p2.y - 0.5 * p3.y) * tt +
                   (-0.5 * p0.y + 0.5 * p2.y) * t + p1.y;

        const v2 = (-0.5 * p0.z + 1.5 * p1.z - 1.5 * p2.z + 0.5 * p3.z) * ttt +
                   (p0.z - 2.5 * p1.z + 2 * p2.z - 0.5 * p3.z) * tt +
                   (-0.5 * p0.z + 0.5 * p2.z) * t + p1.z;

        return new THREE.Vector3(v0, v1, v2);
    }

    /**
     * Get normalized vector between two points
     */
    static directionFromTo(from, to) {
        return to.clone().sub(from).normalize();
    }

    /**
     * Reflect a vector off a surface normal
     */
    static reflect(vector, normal) {
        const n = normal.clone().normalize();
        return vector.clone().sub(n.multiplyScalar(2 * vector.dot(n)));
    }

    /**
     * Get the angle between two vectors in radians
     */
    static angleBetween(v1, v2) {
        return Math.acos(Math.max(-1, Math.min(1, v1.dot(v2))));
    }

    /**
     * Convert polar coordinates to 3D vector (on XY plane)
     */
    static polarToVector(radius, angle) {
        return new THREE.Vector3(
            radius * Math.cos(angle),
            radius * Math.sin(angle),
            0
        );
    }

    /**
     * Convert spherical coordinates to 3D vector
     */
    static sphericalToVector(radius, theta, phi) {
        return new THREE.Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );
    }

    /**
     * Get a vector perpendicular to the input (in 2D XY plane)
     */
    static perpendicularXY(vector) {
        return new THREE.Vector3(-vector.y, vector.x, vector.z);
    }

    /**
     * Smooth damping towards a target value
     */
    static damp(current, target, smoothTime, deltaTime) {
        const omega = 2 / (smoothTime + deltaTime);
        const x = omega * deltaTime;
        const exponential = 1 / (1 + x + x * 0.48 + x * 0.235);
        return current + (target - current) * exponential;
    }

    /**
     * Check if point is inside a triangle (2D, XY plane)
     */
    static pointInTriangle(point, a, b, c) {
        const v0 = new THREE.Vector3(c.x - a.x, c.y - a.y, 0);
        const v1 = new THREE.Vector3(b.x - a.x, b.y - a.y, 0);
        const v2 = new THREE.Vector3(point.x - a.x, point.y - a.y, 0);

        const dot00 = v0.dot(v0);
        const dot01 = v0.dot(v1);
        const dot02 = v0.dot(v2);
        const dot11 = v1.dot(v1);
        const dot12 = v1.dot(v2);

        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

        return u >= 0 && v >= 0 && u + v < 1;
    }
}

export default VectorUtils;
