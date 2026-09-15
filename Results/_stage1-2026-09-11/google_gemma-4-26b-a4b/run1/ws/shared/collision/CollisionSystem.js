/**
 * CollisionSystem.js
 * Hand-written primitive collision math for AABB and Circle collisions.
 */

export class CollisionSystem {
    /**
     * Axis-Aligned Bounding Box (AABB) collision detection.
     * @param {THREE.Object3D} objA 
     * @param {THREE.Object3D} objB 
     * @returns {boolean}
     */
    static checkAABB(objA, objB) {
        const boxA = new THREE.Box3().setFromObject(objA);
        const boxB = new
            new THREE.Box3().setFromObject(objB);
        return boxA.intersectsBox(boxB);
    }

    /**
     * Circle to Box collision detection.
     * @param {THREE.Vector3} circleCenter 
     * @param {number} radius 
     * @param {THREE.Box3} box 
     * @returns {boolean}
     */
    static checkCircleBox(circleCenter, radius, box) {
        // Find the closest point to the circle within the box
        const closestX = Math.max(box.min.x, Math.min(circleCenter.x, box.max.x));
        const closestY = Math.max(box.min.y, Math.min(circleCenter.y, box.max.y));
        const closestZ = Math.max(box.min.z, Math.min(circleCenter.z, box.max.z));

        // Calculate the distance between the circle's center and this closest point
        const distanceX = circleCenter.x - closestX;
        const distanceY = circleCenter.y - closestY;
        const distanceZ = circleCenter.z - closestZ;

        const distanceSquared = (distanceX * distanceX) + 
                               (distanceY * distanceY) + 
                               (distanceZ * distanceZ);

        return distanceSquared < (radius * radius);
    }

    /**
     * Simple Sphere to Sphere collision.
     * @param {THREE.Vector3} posA 
     * @param {number} radA 
     * @param {THREE.Vector3} posB 
     * @param {number} radB 
     * @returns {boolean}
     */
    static checkSphereSphere(posA, radA, posB, radB) {
        const distanceSquared = posA.distanceToSquared(posB);
        const radiusSum = radA + radB;
        return distanceSquared < (radiusSum * radiusSum);
    }
}
