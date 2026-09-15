import * as THREE from 'three';

const POWERUP_TYPES = {
    SPREAD_SHOT: { color: 0xff8800, emissive: 0xff4400, name: 'SPREAD' },
    RAPID_FIRE: { color: 0x00ff88, emissive: 0x00cc66, name: 'RAPID' },
    SHIELD: { color: 0x0088ff, emissive: 0x0044cc, name: 'SHIELD' }
};

export class PowerUp {
    constructor(scene, position, type) {
        this.scene = scene;
        this.type = type;
        this.config = POWERUP_TYPES[type];
        this.active = false;
        this.velocity = new THREE.Vector3(0, -1.5, 0);

        const group = new THREE.Group();
        group.position.copy(position);

        // Main body: octahedron for a crystal-like shape
        const bodyGeo = new THREE.OctahedronGeometry(0.25, 0);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: this.config.color,
            emissive: this.config.emissive,
            emissiveIntensity: 1.5,
            metalness: 0.3,
            roughness: 0.4,
            transparent: true,
            opacity: 0.9
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Outer glow ring
        const ringGeo = new THREE.TorusGeometry(0.35, 0.04, 8, 16);
        const ringMat = new THREE.MeshStandardMaterial({
            color: this.config.color,
            emissive: this.config.emissive,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.7
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        group.add(ring);

        // Point light for glow effect
        this.light = new THREE.PointLight(this.config.color, 1.5, 4);
        group.add(this.light);

        this.mesh = group;
        this.bodyMesh = body;
        this.ringMesh = ring;
        this.rotationSpeed = new THREE.Vector3(2 + Math.random() * 2, 3 + Math.random(), 1 + Math.random());
        this.scene.add(group);
    }

    update(deltaTime) {
        if (!this.active) return;

        // Move downward slowly
        this.mesh.position.y += this.velocity.y * deltaTime;

        // Rotate
        this.bodyMesh.rotation.x += this.rotationSpeed.x * deltaTime;
        this.bodyMesh.rotation.y += this.rotationSpeed.y * deltaTime;
        this.ringMesh.rotation.z += this.rotationSpeed.z * deltaTime;
        this.ringMesh.rotation.x += this.rotationSpeed.x * 0.5 * deltaTime;

        // Pulse the emissive intensity
        const t = performance.now() / 300;
        this.bodyMesh.material.emissiveIntensity = 1.2 + Math.sin(t) * 0.8;
        this.ringMesh.material.emissiveIntensity = 1.5 + Math.cos(t * 1.3) * 0.7;

        // Deactivate if below playfield
        if (this.mesh.position.y < -6) {
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

    destroy() {
        if (this.bodyMesh) {
            this.bodyMesh.geometry.dispose();
            this.bodyMesh.material.dispose();
        }
        if (this.ringMesh) {
            this.ringMesh.geometry.dispose();
            this.ringMesh.material.dispose();
        }
        if (this.light) {
            this.scene.remove(this.light);
            this.light.dispose();
        }
        if (this.mesh && this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
    }
}
