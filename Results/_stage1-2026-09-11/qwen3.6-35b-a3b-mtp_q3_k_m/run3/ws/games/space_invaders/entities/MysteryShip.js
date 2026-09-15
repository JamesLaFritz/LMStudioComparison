import * as THREE from 'three';

const MYSTERY_SHIP_SPEED = 3.0;
const MYSTY_SHIP_COLOR = 0xff4444;
const MYSTERY_SHIP_EMISSIVE = 0xff2222;

export class MysteryShip {
    constructor(scene) {
        this.scene = scene;
        this.mesh = new THREE.Group();

        // Body - elongated diamond shape
        const bodyGeo = new THREE.ConeGeometry(0.3, 1.0, 4);
        bodyGeo.rotateZ(Math.PI / 2);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: MYSTY_SHIP_COLOR,
            emissive: MYSTERY_SHIP_EMISSIVE,
            emissiveIntensity: 2.0,
            metalness: 0.8,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.mesh.add(body);

        // Wings - small side fins
        const wingGeo = new THREE.BoxGeometry(0.6, 0.1, 0.3);
        const wingMat = new THREE.MeshStandardMaterial({
            color: MYSTY_SHIP_COLOR,
            emissive: MYSTERY_SHIP_EMISSIVE,
            emissiveIntensity: 1.5,
            metalness: 0.6,
            roughness: 0.3
        });
        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.set(0, -0.15, 0);
        this.mesh.add(leftWing);

        // Glow light
        this.light = new THREE.PointLight(MYSTY_SHIP_EMISSIVE, 2, 8);
        this.light.position.set(0, 0, 0);
        this.mesh.add(this.light);

        this.direction = 1; // 1 = left to right, -1 = right to left
        this.active = false;
        this.pointsValue = 0;

        this.mesh.visible = false;
        this.scene.add(this.mesh);
    }

    activate(direction) {
        this.direction = direction;
        this.active = true;
        this.mesh.visible = true;

        // Random points value: 50, 100, or 150
        const values = [50, 75, 100, 150];
        this.pointsValue = values[Math.floor(Math.random() * values.length)];

        if (direction === 1) {
            // Left to right
            this.mesh.position.set(-12, 6.5, 0);
        } else {
            // Right to left
            this.mesh.position.set(12, 6.5, 0);
        }

        this.mesh.rotation.y = direction === 1 ? Math.PI / 4 : -Math.PI / 4;
    }

    update(deltaTime) {
        if (!this.active) return;

        const moveX = MYSTY_SHIP_SPEED * this.direction * deltaTime;
        this.mesh.position.x += moveX;

        // Bobbing motion
        this.mesh.position.y += Math.sin(Date.now() * 0.005) * 0.01;

        // Deactivate if off screen
        if ((this.direction === 1 && this.mesh.position.x > 14) ||
            (this.direction === -1 && this.mesh.position.x < -14)) {
            this.deactivate();
        }
    }

    isActive() {
        return this.active;
    }

    deactivate() {
        this.active = false;
        this.mesh.visible = false;
    }

    getPosition() {
        return this.mesh.position.clone();
    }

    getBounds() {
        const pos = this.mesh.position;
        return {
            minX: pos.x - 0.5,
            maxX: pos.x + 0.5,
            minY: pos.y - 0.2,
            maxY: pos.y + 0.2
        };
    }

    destroy() {
        this.mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        this.scene.remove(this.mesh);
        if (this.light) {
            this.light.dispose();
        }
    }
}
