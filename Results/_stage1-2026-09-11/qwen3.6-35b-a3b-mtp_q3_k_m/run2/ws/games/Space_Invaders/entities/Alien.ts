import * as THREE from 'three';
import * as TextureGenerator from '../assets/TextureGenerator.js';

export interface AlienData {
    mesh: THREE.Mesh;
    type: number;
    row: number;
    col: number;
    alive: boolean;
    frame: number;
}

const ALIEN_COLORS = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff88, 0xff3366];
const ALIEN_EMISSIVE_COLORS = [0x004444, 0x440044, 0x444400, 0x004422, 0x441122];

export class Alien implements AlienData {
    mesh: THREE.Mesh;
    type: number;
    row: number;
    col: number;
    alive: boolean = true;
    frame: number = 0;

    private _targetPos: THREE.Vector3 | null = null;
    private _morphStart: THREE.Vector3 | null = null;
    private _morphProgress: number = 1.0;
    private readonly MORPH_DURATION = 0.3;

    constructor(type: number, row: number, col: number) {
        this.type = type;
        this.row = row;
        this.col = col;
        this.frame = 0;

        const texture = TextureGenerator.generateAlienTexture(type, 0);
        const geo = new THREE.BoxGeometry(1.2, 0.8, 0.4);
        const mat = new THREE.MeshStandardMaterial({
            map: texture,
            emissive: ALIEN_EMISSIVE_COLORS[type],
            emissiveIntensity: 0.5,
            color: ALIEN_COLORS[type],
        });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.set(0, 0, 0);
        texture.dispose();
    }

    setInitialPosition(pos: THREE.Vector3): void {
        this.mesh.position.copy(pos);
        this._targetPos = null;
        this._morphStart = null;
        this._morphProgress = 1.0;
    }

    morphTo(newPos: THREE.Vector3, duration?: number): void {
        if (this._morphProgress >= 1.0) {
            this._morphStart = new THREE.Vector3().copy(this.mesh.position);
            this._targetPos = newPos.clone();
            this._morphProgress = 0;
        }
    }

    updateMorph(delta: number): void {
        if (this._morphStart && this._targetPos && this._morphProgress < 1.0) {
            const dur = duration ?? this.MORPH_DURATION;
            this._morphProgress += delta / dur;
            if (this._morphProgress >= 1.0) {
                this.mesh.position.copy(this._targetPos);
                this._morphStart = null;
                this._targetPos = null;
                this._morphProgress = 1.0;
            } else {
                const t = easeInOutQuad(this._morphProgress);
                this.mesh.position.lerpVectors(this._morphStart, this._targetPos, t);
            }
        }
    }

    toggleFrame(): void {
        this.frame = this.frame === 0 ? 1 : 0;
        const texture = TextureGenerator.generateAlienTexture(this.type, this.frame);
        if (this.mesh.material instanceof THREE.MeshStandardMaterial) {
            if (this.mesh.material.map) this.mesh.material.map.dispose();
            this.mesh.material.map = texture;
            this.mesh.material.needsUpdate = true;
        }
    }

    dispose(): void {
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material instanceof THREE.MeshStandardMaterial) {
            if (this.mesh.material.map) this.mesh.material.map.dispose();
            this.mesh.material.dispose();
        }
        this.mesh.parent?.remove(this.mesh);
    }
}

function easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
