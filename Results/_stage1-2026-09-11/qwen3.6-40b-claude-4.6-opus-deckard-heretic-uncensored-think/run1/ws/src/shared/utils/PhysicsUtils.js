/**
 * Physics Utilities - Collision detection math, trajectory calculations, impulse responses
 */
class PhysicsUtils {
    // AABB collision detection
    static checkAABB(box1, box2) {
        return (box1.x < box2.x + box2.width &&
                box1.x + box1.width > box2.x &&
                box1.y < box2.y + box2.height &&
                box1.y + box1.height > box2.y);
    }

    // Circle collision detection
    static checkCircle(circle1, circle2) {
        const dx = circle1.x - circle2.x;
        const dy = circle1.y - circle2.y;
        const distanceSquared = dx * dx + dy * dy;
        return distanceSquared < (circle1.radius + circle2.radius) ** 2;
    }

    // Point to line collision detection
    static checkPointLine(point, lineStart, lineEnd) {
        const dx = point.x - lineStart.x;
        const dy = point.y - lineStart.y;

        const lineLengthSquared = (lineEnd.x - lineStart.x) ** 2 + 
                                 (lineEnd.y - lineStart.y) ** 2;

        if (lineLengthSquared === 0) return false;

        let t = ((dx * (lineEnd.x - lineStart.x)) + (dy * (lineEnd.y - lineStart.y)))) / lineLengthSquared;
        t = Math.max(0, Math.min(1, t));

        const closestX = lineStart.x + t * (lineEnd.x - lineStart.x);
        const closestY = lineStart.y + t * (lineEnd.y - lineStart.y));

        return PhysicsUtils.checkPointCircle(point, {x: closestX, y: closestY}, point.radius);
    }

    // Calculate impulse response for collision
    static calculateImpulse(obj1, obj2, restitution = 0.8) {
        const relativeVelocity = {
            x: obj1.velocity.x - obj2.velocity.x,
            y: obj1.velocity.y - obj2.velocity.y
        };

        // Calculate normal vector
        let normal = {
            x: obj1.position.x - obj2.position.x,
            y: obj1.position.y - obj2.position.y
        };

        const length = Math.sqrt(normal.x ** 2 + normal.y ** 2);
        if (length === 0) return { impulseX: 0, impulseY: 0 };

        normal.x /= length;
        normal.y /= length;

        // Calculate impulse magnitude
        const j = -(1 + restitution) * (relativeVelocity.x * normal.x + relativeVelocity.y * normal.y);

        return {
            impulseX: j * normal.x,
            impulseY: j * normal.y
        };
    }

    // Apply impulse to object
    static applyImpulse(obj, impulseX, impulseY) {
        obj.velocity.x += impulseX / obj.mass;
        obj.velocity.y += impulseY / obj.mass;
    }

    // Calculate trajectory for projectile
    static calculateTrajectory(startX, startY, angle, velocity) {
        const radians = angle * Math.PI / 180;

        return {
            x: startX + velocity * Math.cos(radians),
            y: startY + velocity * Math.sin(radians)
        };
    }

    // Check if point is within bounds
    static checkBounds(point, minX, minY, maxX, maxY) {
        return (point.x >= minX && point.x <= maxX &&
                point.y >= minY && point.y <= maxY);
    }
}

export default PhysicsUtils;
