/**
 * AABB (Axis-Aligned Bounding Box) utilities for collision detection
 */

export class AABB {
    /**
     * @param {THREE.Vector3} min - Minimum corner of the box
     * @param {THREE.Vector3} max - Maximum corner of the box
     */
    constructor(min, max) {
        this.min = min || new THREE.Vector3();
        this.max = max || new THREE.Vector3();
    }

    /**
     * Create AABB from a Three.js object with optional size override
     * @param {THREE.Object3D} object - The mesh/object to bound
     * @param {THREE.Vector3} [size] - Optional custom size (uses bounding box if not provided)
     * @returns {AABB}
     */
    static fromObject(object, size = null) {
        const center = object.position.clone();
        
        let halfSize;
        if (size) {
            halfSize = size.clone().multiplyScalar(0.5);
        } else {
            // Calculate from geometry bounding box
            const bbox = new THREE.Box3().setFromObject(object);
            const extent = new THREE.Vector3();
            bbox.getSize(extent);
            halfSize = extent.multiplyScalar(0.5);
        }

        const min = center.clone().sub(halfSize);
        const max = center.clone().add(halfSize);
        
        return new AABB(min, max);
    }

    /**
     * Check if this AABB overlaps with another
     * @param {AABB} other - The other bounding box
     * @returns {boolean}
     */
    intersects(other) {
        return (
            this.min.x <= other.max.x &&
            this.max.x >= other.min.x &&
            this.min.y <= other.max.y &&
            this.max.y >= other.min.y &&
            this.min.z <= other.max.z &&
            this.max.z >= other.min.z
        );
    }

    /**
     * Expand this AABB to include another point or box
     * @param {AABB|THREE.Vector3} other - Box or point to expand towards
     */
    expandToInclude(other) {
        if (other instanceof AABB) {
            this.min.x = Math.min(this.min.x, other.min.x);
            this.min.y = Math.min(this.min.y, other.min.y);
            this.min.z = Math.min(this.min.z, other.min.z);
            this.max.x = Math.max(this.max.x, other.max.x);
            this.max.y = Math.max(this.max.y, other.max.y);
            this.max.z = Math.max(this.max.z, other.max.z);
        } else {
            // It's a Vector3 point
            this.min.x = Math.min(this.min.x, other.x);
            this.min.y = Math.min(this.min.y, other.y);
            this.min.z = Math.min(this.min.z, other.z);
            this.max.x = Math.max(this.max.x, other.x);
            this.max.y = Math.max(this.max.y, other.y);
            this.max.z = Math.max(this.max.z, other.z);
        }
    }

    /**
     * Get the center point of the AABB
     * @returns {THREE.Vector3}
     */
    getCenter() {
        return new THREE.Vector3(
            (this.min.x + this.max.x) * 0.5,
            (this.min.y + this.max.y) * 0.5,
            (this.min.z + this.max.z) * 0.5
        );
    }

    /**
     * Get the size of the AABB
     * @returns {THREE.Vector3}
     */
    getSize() {
        return new THREE.Vector3(
            this.max.x - this.min.x,
            this.max.y - this.min.y,
            this.max.z - this.min.z
        );
    }

    /**
     * Clone this AABB
     * @returns {AABB}
     */
    clone() {
        return new AABB(
            this.min.clone(),
            this.max.clone()
        );
    }
}

/**
 * Circle collision utilities (for 2D-style games in 3D space)
 */
export class Circle2D {
    /**
     * @param {THREE.Vector3} center - Center point (x, y used; z ignored)
     * @param {number} radius - Radius of the circle
     */
    constructor(center, radius) {
        this.center = center || new THREE.Vector3();
        this.radius = radius || 0.5;
    }

    /**
     * Create Circle2D from a Three.js object with optional radius override
     * @param {THREE.Object3D} object - The mesh/object to bound
     * @param {number} [radius] - Optional custom radius
     * @returns {Circle2D}
     */
    static fromObject(object, radius = null) {
        const center = object.position.clone();
        
        if (radius === null) {
            // Estimate radius from bounding box
            const bbox = new THREE.Box3().setFromObject(object);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            radius = Math.max(size.x, size.y) * 0.5;
        }

        return new Circle2D(center, radius);
    }

    /**
     * Check if this circle overlaps with another (2D on XY plane)
     * @param {Circle2D} other - The other circle
     * @returns {boolean}
     */
    intersects(other) {
        const dx = this.center.x - other.center.x;
        const dy = this.center.y - other.center.y;
        const distanceSquared = dx * dx + dy * dy;
        const minDistance = this.radius + other.radius;
        
        return distanceSquared < minDistance * minDistance;
    }

    /**
     * Check if a point is inside this circle (2D on XY plane)
     * @param {THREE.Vector3} point - The point to check
     * @returns {boolean}
     */
    containsPoint(point) {
        const dx = point.x - this.center.x;
        const dy = point.y - this.center.y;
        return (dx * dx + dy * dy) < (this.radius * this.radius);
    }

    /**
     * Clone this circle
     * @returns {Circle2D}
     */
    clone() {
        return new Circle2D(
            this.center.clone(),
            this.radius
        );
    }
}
