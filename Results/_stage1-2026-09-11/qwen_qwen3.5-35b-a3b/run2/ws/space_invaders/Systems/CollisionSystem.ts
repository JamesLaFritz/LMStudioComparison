import { Vector3, Box3 } from 'three';

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class CollisionSystem {
    public static checkCollision(rect1: Rect, rect2: Rect): boolean {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    public static checkCircleRect(circle: Vector3, radius: number, rect: Rect): boolean {
        const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

        const distanceX = circle.x - closestX;
        const distanceY = circle.y - closestY;

        return (distanceX * distanceX + distanceY * distanceY) < (radius * radius);
    }

    public static checkAABB(obj1: { position: Vector3, width: number, height: number }, 
                           obj2: { position: Vector3, width: number, height: number }): boolean {
        const halfWidth1 = obj1.width / 2;
        const halfHeight1 = obj1.height / 2;
        const halfWidth2 = obj2.width / 2;
        const halfHeight2 = obj2.height / 2;

        return Math.abs(obj1.position.x - obj2.position.x) < (halfWidth1 + halfWidth2) &&
               Math.abs(obj1.position.y - obj2.position.y) < (halfHeight1 + halfHeight2);
    }
}