import * as THREE from 'three';
import { AudioSynth } from '../assets/AudioSynth';

export class MysteryShip {
    private mesh: THREE.Mesh;
    private active: boolean = false;
    private direction: number = 1;
    private speed: number = 2.5;
    private position: THREE.Vector3 = new THREE.Vector3();
    private points: number = 0;
    private audioSynth: AudioSynth | null = null;

    constructor(audioSynth?: AudioSynth) {
        const shape = new THREE.Shape();
        shape.moveTo(-1.2, -0.2);
        shape.quadraticCurveTo(-0.8, 0.5, 0, 0.6);
        shape.quadraticCurveTo(0.8, 0.5, 1.2, -0.2);
        shape.lineTo(0.8, -0.4);
        shape.lineTo(-0.8, -0.4);
        shape.closePath();

        const extrudeSettings: THREE.ExtrudeGeometryOptions = { depth: 0.3, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.center();

        const material = new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0xff00ff,
            emissiveIntensity: 1.2,
            roughness: 0.3,
            metalness: 0.7,
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.points = [100, 200, 300][Math.floor(Math.random() * 3)];
        if (audioSynth) {
            this.audioSynth = audioSynth;
        }
    }

    public spawn(scene: THREE.Scene, sceneWidth: number): void {
        this.active = true;
        const startX = -sceneWidth / 2 - 2;
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.position.set(startX + (this.direction === 1 ? 0 : sceneWidth * 2), 6.5, 0);
        this.mesh.position.copy(this.position);
        this.mesh.visible = true;
        scene.add(this.mesh);

        if (Math.random() < 0.33) this.points = 100;
        else if (Math.random() < 0.5) this.points = 200;
        else this.points = 300;
    }

    public update(delta: number, sceneWidth: number): void {
        if (!this.active) return;
        const moveAmount = this.speed * this.direction * delta;
        this.position.x += moveAmount;

        if ((this.direction > 0 && this.position.x > sceneWidth / 2 + 3) ||
            (this.direction < 0 && this.position.x < -sceneWidth / 2 - 3)) {
            this.destroy();
            return;
        }

        this.mesh.position.copy(this.position);
    }

    public getBounds(): THREE.Box3 {
        const box = new THREE.Box3().setFromObject(this.mesh);
        return box;
    }

    public getPoints(): number {
        return this.points;
    }

    public isActive(): boolean {
        return this.active;
    }

    public destroy(): void {
        if (this.audioSynth) {
            this.audioSynth.playSaucerBeep();
        }
        this.mesh.visible = false;
        this.active = false;
    }

    public dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}
