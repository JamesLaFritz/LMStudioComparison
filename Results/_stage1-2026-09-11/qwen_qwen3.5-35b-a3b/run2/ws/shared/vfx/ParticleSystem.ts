import { 
    Vector3, 
    Color, 
    BufferGeometry, 
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    Material,
    Object3D
} from 'three';

export interface ParticleData {
    position: Vector3;
    velocity: Vector3;
    color: Color;
    lifetime: number;
    decay: number;
    size: number;
}

export class ParticleSystem {
    private particles: ParticleData[] = [];
    private maxParticles: number = 500;
    private geometry: BufferGeometry | null = null;
    private points: Points | null = null;
    
    constructor() {
        this.geometry = new BufferGeometry();
        const positions = new Float32Array(this.maxParticles * 3);
        const colors = new Float32Array(this.maxParticles * 3);
        const sizes = new Float32Array(this.maxParticles);
        
        this.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
        this.geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
        
        const material = new PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: 1, // THREE.AdditiveBlending
            depthWrite: false
        });
        
        this.points = new Points(this.geometry, material);
        this.points.visible = false;
    }

    public getMesh(): Object3D | null {
        return this.points;
    }

    public spawnExplosion(
        position: Vector3, 
        count: number, 
        color: Color,
        velocityScale: number = 100,
        size: number = 0.5
    ): void {
        const actualCount = Math.min(count, this.maxParticles - this.particles.length);
        
        for (let i = 0; i < actualCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * velocityScale;
            
            const particle: ParticleData = {
                position: position.clone(),
                velocity: new Vector3(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    (Math.random() - 0.5) * speed * 0.5
                ),
                color: color.clone(),
                lifetime: Math.random() * 0.8 + 0.4,
                decay: Math.random() * 0.02 + 0.01,
                size: size * (Math.random() * 0.5 + 0.75)
            };
            
            this.particles.push(particle);
        }
    }

    public spawnSpark(
        position: Vector3, 
        color: Color,
        velocity: Vector3,
        lifetime: number = 0.6,
        size: number = 0.3
    ): void {
        if (this.particles.length >= this.maxParticles) return;

        const particle: ParticleData = {
            position: position.clone(),
            velocity: velocity.clone().multiplyScalar(50),
            color: color.clone(),
            lifetime: lifetime,
            decay: 0.015,
            size: size
        };
        
        this.particles.push(particle);
    }

    public update(deltaTime: number): void {
        if (this.particles.length === 0) {
            if (this.points) this.points.visible = false;
            return;
        }

        const positions = this.geometry!.getAttribute('position').array as Float32Array;
        const colors = this.geometry!.getAttribute('color').array as Float32Array;
        const sizes = this.geometry!.getAttribute('size').array as Float32Array;

        let activeCount = 0;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            
            // Update position
            p.position.add(p.velocity.clone().multiplyScalar(deltaTime));
            
            // Apply velocity decay
            p.velocity.multiplyScalar(1 - p.decay * deltaTime);
            
            // Reduce lifetime
            p.lifetime -= deltaTime;
            
            if (p.lifetime > 0) {
                // Copy particle data to buffer
                const idx = activeCount * 3;
                positions[idx] = p.position.x;
                positions[idx + 1] = p.position.y;
                positions[idx + 2] = p.position.z;
                
                colors[idx] = p.color.r;
                colors[idx + 1] = p.color.g;
                colors[idx + 2] = p.color.b;
                
                sizes[activeCount] = p.size * (p.lifetime / 0.8); // Fade size
                
                activeCount++;
            }
        }

        this.particles = this.particles.filter(p => p.lifetime > 0);
        
        if (this.points) {
            this.geometry!.setAttribute('position', new Float32BufferAttribute(positions, 3));
            this.geometry!.setAttribute('color', new Float32BufferAttribute(colors, 3));
            this.geometry!.setAttribute('size', new Float32BufferAttribute(sizes, 1));
            this.geometry!.attributes.position.needsUpdate = true;
            this.geometry!.attributes.color.needsUpdate = true;
            this.geometry!.attributes.size.needsUpdate = true;
            
            this.points.visible = activeCount > 0;
        }
    }

    public dispose(): void {
        if (this.geometry) {
            this.geometry.dispose();
        }
        if (this.points && this.points.material) {
            const mat = this.points.material as PointsMaterial;
            mat.dispose();
        }
        this.particles = [];
    }
}
