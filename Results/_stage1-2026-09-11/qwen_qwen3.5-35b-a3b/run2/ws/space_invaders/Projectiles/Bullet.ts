import { Vector3, Color, Mesh, InstancedMesh, BufferGeometry, Matrix4 } from 'three';
import { ObjectPool } from '../../shared/core/ObjectPool';

export class Bullet {
    public mesh: Mesh;
    public position: Vector3;
    public velocity: Vector3;
    public active: boolean = false;
    public ownerType: 'player' | 'enemy' = 'player';
    
    private pool: ObjectPool<Bullet>;
    private geometry: BufferGeometry;
    private material: Mesh;

    constructor(pool: ObjectPool<Bullet>) {
        this.pool = pool;
        this.position = new Vector3();
        this.velocity = new Vector3();
        
        // Create bullet mesh (simple retro rectangle)
        const bulletGeo = new BufferGeometry();
        const vertices = new Float32Array([
            -0.5, -1.0, 0,   // bottom left
             0.5, -1.0, 0,   // bottom right
             0.5,  1.0, 0,   // top right
            -0.5,  1.0, 0    // top left
        ]);
        
        bulletGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        bulletGeo.setIndex([0, 1, 2, 2, 3, 0]); // Two triangles
        
        const bulletMat = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff,
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(bulletGeo, bulletMat);
        this.mesh.visible = false;
    }

    public activate(position: Vector3, velocity: Vector3, ownerType: 'player' | 'enemy'): void {
        this.position.copy(position);
        this.velocity.copy(velocity);
        this.active = true;
        this.ownerType = ownerType;
        
        this.mesh.position.copy(position);
        this.mesh.visible = true;
    }

    public deactivate(): void {
        this.active = false;
        this.mesh.visible = false;
    }

    public update(deltaTime: number): boolean {
        if (!this.active) return false;

        // Move bullet
        this.position.addScaledVector(this.velocity, deltaTime);
        this.mesh.position.copy(this.position);

        // Deactivate if out of bounds
        const Y_MIN = -35;
        const Y_MAX = 35;
        
        if (this.position.y < Y_MIN || this.position.y > Y_MAX) {
            this.deactivate();
            return false;
        }

        return true;
    }

    public getBounds(): { x: number; y: number; width: number; height: number } {
        const halfW = 0.5;
        const halfH = 1.0;
        return {
            x: this.position.x - halfW,
            y: this.position.y - halfH,
            width: halfW * 2,
            height: halfH * 2
        };
    }

    public dispose(): void {
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

// Export for Boss.ts reference
export const BulletClass = Bullet;