import { Vector2, Vector3, Color } from 'three';

export class MathUtils {
    static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    static lerp(start: number, end: number, t: number): number {
        return start + (end - start) * t;
    }

    static lerpVector(v1: Vector3, v2: Vector3, t: number): Vector3 {
        return new Vector3(
            this.lerp(v1.x, v2.x, t),
            this.lerp(v1.y, v2.y, t),
            this.lerp(v1.z, v2.z, t)
        );
    }

    static randomRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }

    static randomInt(min: number, max: number): number {
        return Math.floor(this.randomRange(min, max));
    }

    static randomUnitVector(): Vector3 {
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        return new Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        );
    }

    static randomUnitVector2D(): Vector2 {
        const angle = Math.random() * 2 * Math.PI;
        return new Vector2(Math.cos(angle), Math.sin(angle));
    }

    static hexToColor(hex: string): Color {
        return new Color(hex);
    }

    static lerpColors(c1: Color, c2: Color, t: number): Color {
        return new Color().lerpColors(c1, c2, t);
    }

    static distanceSquared(v1: Vector3, v2: Vector3): number {
        const dx = v1.x - v2.x;
        const dy = v1.y - v2.y;
        const dz = v1.z - v2.z;
        return dx * dx + dy * dy + dz * dz;
    }

    static distance(v1: Vector3, v2: Vector3): number {
        return Math.sqrt(this.distanceSquared(v1, v2));
    }

    static normalizeVector(v: Vector3): Vector3 {
        const len = v.length();
        if (len > 0) {
            return v.clone().divideScalar(len);
        }
        return new Vector3(0, 0, 0);
    }

    static rotateVector2D(vec: Vector2, angle: number): Vector2 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vector2(
            vec.x * cos - vec.y * sin,
            vec.x * sin + vec.y * cos
        );
    }

    static easeInOutCubic(t: number): number {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    static easeOutQuart(t: number): number {
        return 1 - Math.pow(1 - t, 4);
    }

    static smoothStep(edge0: number, edge1: number, x: number): number {
        const t = this.clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    }

    static map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    }
}