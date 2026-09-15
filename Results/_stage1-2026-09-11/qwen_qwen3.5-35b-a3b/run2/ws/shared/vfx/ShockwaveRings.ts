import { Vector3, Color, RingGeometry, MeshBasicMaterial, Scene, Object3D } from 'three';

export class ShockwaveRing {
    public mesh: Object3D;
    private radius: number = 1.0;
    private maxRadius: number;
    private expansionSpeed: number;
    private opacity: number = 1.0;
    private decayRate: number = 0.95;

    constructor(position: Vector3, color: Color, initialRadius: number, expansionSpeed: number) {
        const geometry = new RingGeometry(initialRadius, initialRadius + 2, 32);
        const material = new MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1.0,
            side: 2 // DoubleSide
        });

        this.mesh = new Object3D();
        this.mesh.position.copy(position);
        
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = Math.PI / 2;
        this.mesh.add(ring);
        
        this.maxRadius = initialRadius + 50;
        this.expansionSpeed = expansionSpeed;
    }

    public update(deltaTime: number): boolean {
        this.radius += this.expansionSpeed * deltaTime;
        this.opacity *= this.decayRate;

        if (this.mesh.children[0]) {
            const ringMesh = this.mesh.children[0] as THREE.Mesh;
            ringMesh.material.opacity = Math.max(0, this.opacity);
            
            // Update geometry scale to expand ring
            const scale = this.radius / 1.0;
            ringMesh.scale.set(scale, scale, 1);
        }

        return this.opacity > 0.05 && this.radius < this.maxRadius;
    }

    public dispose(): void {
        if (this.mesh.children[0]) {
            const ringMesh = this.mesh.children[0] as THREE.Mesh;
            ringMesh.geometry.dispose();
            ringMesh.material.dispose();
        }
        this.mesh.clear();
    }
}

export class ShockwaveRings {
    private scene: Scene;
    private rings: ShockwaveRing[] = [];

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public spawn(position: Vector3, count: number = 1): void {
        for (let i = 0; i < count; i++) {
            const color = new Color(i === 0 ? '#FFD700' : '#00FFFF'); // Gold center, cyan outer
            const ring = new ShockwaveRing(
                position.clone(),
                color,
                0.5 + i * 0.3,
                100 + i * 50
            );
            this.scene.add(ring.mesh);
            this.rings.push(ring);
        }
    }

    public update(deltaTime: number): void {
        this.rings = this.rings.filter(ring => {
            const active = ring.update(deltaTime);
            if (!active) {
                this.scene.remove(ring.mesh);
                ring.dispose();
            }
            return active;
        });
    }

    public dispose(): void {
        this.rings.forEach(ring => {
            this.scene.remove(ring.mesh);
            ring.dispose();
        });
        this.rings = [];
    }
}