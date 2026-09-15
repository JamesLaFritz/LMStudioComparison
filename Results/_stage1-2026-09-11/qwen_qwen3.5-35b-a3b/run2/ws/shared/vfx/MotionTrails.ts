import { Vector3, Color, LineSegments, BufferGeometry, Float32BufferAttribute } from 'three';

export interface TrailPoint {
    position: Vector3;
    color: Color;
    time: number;
}

export class MotionTrail {
    private points: TrailPoint[] = [];
    private maxPoints: number = 10;
    private trailMesh: LineSegments | null = null;
    private geometry: BufferGeometry | null = null;
    private colors: Float32BufferAttribute | null = null;

    constructor(private color: Color, private speedThreshold: number = 100) {
        this.geometry = new BufferGeometry();
        this.colors = new Float32BufferAttribute(new Array(0), 3);
        this.geometry.setAttribute('color', this.colors);
        this.trailMesh = new LineSegments(this.geometry, null); // Material set later
    }

    public addPoint(position: Vector3): void {
        if (this.points.length >= this.maxPoints) {
            this.points.shift();
        }
        this.points.push({
            position: position.clone(),
            color: this.color.clone(),
            time: performance.now()
        });
    }

    public update(): boolean {
        const now = performance.now();
        
        // Remove old points (older than 1.5 seconds)
        this.points = this.points.filter(p => now - p.time < 1500);

        if (this.points.length < 2) {
            return false;
        }

        // Update geometry
        const positions: number[] = [];
        const colorArray = new Float32Array(this.points.length * 6); // 2 vertices per segment, 3 components each

        for (let i = 0; i < this.points.length - 1; i++) {
            const p1 = this.points[i];
            const p2 = this.points[i + 1];

            positions.push(
                p1.position.x, p1.position.y, p1.position.z,
                p2.position.x, p2.position.y, p2.position.z
            );

            // Fade opacity based on age
            const ageRatio = (now - p1.time) / 1500;
            const alpha = Math.max(0, 1 - ageRatio * 1.5);
            
            colorArray[i * 6] = p1.color.r * alpha;
            colorArray[i * 6 + 1] = p1.color.g * alpha;
            colorArray[i * 6 + 2] = p1.color.b * alpha;
            colorArray[i * 6 + 3] = p2.color.r * alpha;
            colorArray[i * 6 + 4] = p2.color.g * alpha;
            colorArray[i * 6 + 5] = p2.color.b * alpha;
        }

        this.geometry!.setAttribute('position', new Float32BufferAttribute(positions, 3));
        if (this.colors) {
            this.colors.count = colorArray.length / 3;
            this.colors.array.set(colorArray);
        }

        return true;
    }

    public dispose(): void {
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }
        if (this.trailMesh) {
            // Material disposal handled by caller
            this.trailMesh = null;
        }
        this.points = [];
    }

    public getTrailMesh(): LineSegments | null {
        return this.trailMesh;
    }
}

export class MotionTrailsManager {
    private trails: Map<string, MotionTrail> = new Map();
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public createTrail(id: string, color: Color): void {
        if (!this.trails.has(id)) {
            const trail = new MotionTrail(color);
            this.trails.set(id, trail);
            
            // Create mesh with proper material
            const material = new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.8
            });
            trail.getTrailMesh()?.setMaterial(material);
            this.scene.add(trail.getTrailMesh()!);
        }
    }

    public addPoint(id: string, position: Vector3): void {
        const trail = this.trails.get(id);
        if (trail) {
            trail.addPoint(position);
        }
    }

    public updateAll(): void {
        for (const [id, trail] of this.trails.entries()) {
            if (!trail.update()) {
                // Remove from scene if no points
                const mesh = trail.getTrailMesh();
                if (mesh) {
                    this.scene.remove(mesh);
                    trail.dispose();
                    this.trails.delete(id);
                }
            }
        }
    }

    public dispose(): void {
        for (const trail of this.trails.values()) {
            const mesh = trail.getTrailMesh();
            if (mesh) {
                this.scene.remove(mesh);
            }
            trail.dispose();
        }
        this.trails.clear();
    }
}