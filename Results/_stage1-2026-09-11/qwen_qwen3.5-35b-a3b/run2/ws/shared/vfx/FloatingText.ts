import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export class FloatingText {
    private texts: FloatingTextItem[] = [];
    private font: THREE.Font | null = null;
    private loader: FontLoader;

    constructor() {
        this.loader = new FontLoader();
        this.loadRetroFont();
    }

    private loadRetroFont(): void {
        // Load a standard font from Three.js examples CDN
        this.loader.load(
            'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
            (font) => {
                this.font = font;
            },
            undefined,
            (err) => {
                console.error('Font loading error:', err);
            }
        );
    }

    public spawn(position: THREE.Vector3, text: string, color: string, size: number = 1): void {
        if (!this.font) return;

        const geometry = new TextGeometry(text, {
            font: this.font,
            size: size * 2,
            height: 0.5,
            curveSegments: 4,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.05,
            bevelOffset: 0,
            bevelSegments: 2
        });

        geometry.center();

        const material = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 1.0
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
        // Add slight random rotation for variety
        mesh.rotation.x = Math.random() * 0.2;
        mesh.rotation.y = Math.random() * 0.2;

        const item: FloatingTextItem = {
            mesh: mesh,
            velocity: new THREE.Vector3(0, 150, 0), // Float upward
            lifetime: 2.0,
            maxLifetime: 2.0,
            color: color
        };

        this.texts.push(item);
    }

    public update(deltaTime: number): void {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const item = this.texts[i];
            
            // Update lifetime
            item.lifetime -= deltaTime;
            
            if (item.lifetime <= 0) {
                // Cleanup
                item.mesh.geometry.dispose();
                item.mesh.material.dispose();
                this.texts.splice(i, 1);
                continue;
            }

            // Move upward
            item.mesh.position.addScaledVector(item.velocity, deltaTime);
            
            // Fade out
            const opacity = Math.max(0, item.lifetime / item.maxLifetime);
            item.mesh.material.opacity = opacity;
            
            // Slight rotation for dynamic effect
            item.mesh.rotation.z += deltaTime * 2;
        }
    }

    public addToScene(scene: THREE.Scene): void {
        this.texts.forEach(item => scene.add(item.mesh));
    }

    public clear(): void {
        this.texts.forEach(item => {
            item.mesh.geometry.dispose();
            item.mesh.material.dispose();
        });
        this.texts = [];
    }
}

interface FloatingTextItem {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    lifetime: number;
    maxLifetime: number;
    color: string;
}