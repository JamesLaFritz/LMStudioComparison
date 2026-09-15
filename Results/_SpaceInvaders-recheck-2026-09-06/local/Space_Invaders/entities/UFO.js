import * as THREE from 'three';
import { MaterialFactory } from '../../shared/rendering/MaterialFactory.js';
import { Vec3Util } from '../../shared/math/Vec3Util.js';

const UFO_SPEED = 8.0;
const UFO_WIDTH = 2.4;
const UFO_HEIGHT = 0.6;
const UFO_DEPTH = 1.2;
const UFO_Y = 12.0;

export class UFO {
    constructor() {
        this.mesh = null;
        this.pointLight = null;
        this.active = false;
        this.direction = 1;
        this.position = new THREE.Vector3();
        this.bowlingPoints = 0;
        this._bowlingValues = [50, 100, 150, 200, 250, 300, 350, 400];
        this._bowlingIndex = Math.floor(Math.random() * this._bowlingValues.length);
        this.bowlingPoints = this._bowlingValues[this._bowlingIndex];
    }

    init(scene) {
        const group = new THREE.Group();

        // Main saucer body — flattened cylinder
        const bodyGeo = new THREE.CylinderGeometry(1.0, 0.8, 0.35, 24);
        const bodyMat = MaterialFactory.createNeonMaterial({
            color: 0xff3366,
            emissive: 0xff3366,
            emissiveIntensity: 1.5,
            metalness: 0.8,
            roughness: 0.2,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Dome on top — hemisphere via sphere geometry
        const domeGeo = new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = MaterialFactory.createNeonMaterial({
            color: 0xffaa33,
            emissive: 0xffaa33,
            emissiveIntensity: 1.2,
            metalness: 0.6,
            roughness: 0.3,
            transparent: true,
            opacity: 0.85,
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = 0.17;
        group.add(dome);

        // Glowing ring around the base
        const ringGeo = new THREE.TorusGeometry(0.9, 0.06, 8, 32);
        const ringMat = MaterialFactory.createNeonMaterial({
            color: 0xff5544,
            emissive: 0xff5544,
            emissiveIntensity: 2.0,
            metalness: 1.0,
            roughness: 0.1,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.15;
        group.add(ring);

        // Point light for neon glow
        this.pointLight = new THREE.PointLight(0xff3366, 4, 8);
        this.pointLight.position.set(0, 0.3, 0);
        group.add(this.pointLight);

        group.scale.set(UFO_WIDTH / 2, UFO_HEIGHT / 0.5, UFO_DEPTH / 0.7);

        this.mesh = group;
        scene.add(group);

        this.active = false;
        this.direction = 1;
    }

    spawn(scene, startX) {
        if (!this.mesh) {
            this.init(scene);
        }
        this.active = true;
        this.direction = Math.random() < 0.5 ? 1 : -1;
        const xPos = this.direction === 1 ? -28 : 28;
        this.position.set(xPos, UFO_Y, 0);
        this.mesh.position.copy(this.position);
        this.mesh.visible = true;
    }

    update(dt) {
        if (!this.active || !this.mesh) return false;

        const moveAmount = UFO_SPEED * dt * this.direction;
        this.position.x += moveAmount;

        // Despawn when off-screen
        if (this.position.x > 32 || this.position.x < -32) {
            this.deactivate();
            return false;
        }

        this.mesh.position.copy(this.position);

        // Pulse the emissive intensity for visual flair
        const pulse = Math.sin(performance.now() * 0.008) * 0.5 + 1.5;
        if (this.pointLight) {
            this.pointLight.intensity = pulse * 2;
        }

        return true;
    }

    deactivate() {
        this.active = false;
        if (this.mesh) {
            this.mesh.visible = false;
        }
    }

    getAABB() {
        if (!this.active || !this.position) return null;
        const halfW = UFO_WIDTH * 0.5;
        const halfH = UFO_HEIGHT * 0.5;
        return {
            minX: this.position.x - halfW,
            maxX: this.position.x + halfW,
            minY: this.position.y - halfH,
            maxY: this.position.y + halfH,
            minZ: this.position.z - UFO_DEPTH * 0.5,
            maxZ: this.position.z + UFO_DEPTH * 0.5,
        };
    }

    dispose() {
        if (!this.mesh) return;
        this.mesh.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (child.material.isMaterial) {
                    child.material.dispose();
                }
            }
        });
        if (this.pointLight) {
            this.pointLight.dispose();
        }
        this.mesh.parent?.remove(this.mesh);
        this.mesh = null;
    }
}
