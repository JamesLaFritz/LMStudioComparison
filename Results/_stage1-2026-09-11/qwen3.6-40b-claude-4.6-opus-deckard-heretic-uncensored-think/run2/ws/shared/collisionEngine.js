// Collision Engine - Hand-written collision detection and response

export class CollisionEngine {
    static checkAABB(a, b) {
        return (a.min.x < b.max.x && a.max.x > b.min.x &&
                a.min.y < b.max.y && a.max.y > b.min.y);
    }

    static checkSphere(entity1, entity2) {
        const dx = entity1.position.x - entity2.position.x;
        const dy = entity1.position.y - entity2.position.y;
        const dz = entity1.position.z - entity2.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        return distSq <= (entity1.radius + entity2.radius) ** 2;
    }

    static checkPointInRect(point, rect) {
        return point.x >= rect.min.x && point.x <= rect.max.x &&
               point.y >= rect.min.y && point.y <= rect.maxy;
    }

    static getOverlap(a, b) {
        const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
        const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
        return { x: Math.max(0, overlapX), y: Math.max(0, overlapY) };
    }

    static reflectVector(v, normal) {
        const dot = v.x * normal.x + v.y * normal.y;
        return { x: v.x - 2 * normal.x * dot, y: v.y - 2 * normal.y * dot };
    }
}
