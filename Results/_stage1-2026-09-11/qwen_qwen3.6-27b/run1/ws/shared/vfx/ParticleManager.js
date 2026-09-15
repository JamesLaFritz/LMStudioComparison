import * as THREE from 'three';

const MAX_PARTICLES = 500;

class ParticleManager {
    constructor(scene) {
        this.scene = scene;
        this.active = [];
        this.geometry = new THREE.SphereGeometry(0.08, 4, 4);
        this.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 2.0,
            roughness: 0.5,
            metalness: 0.0,
            toneMapped: false
        });
        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_PARTICLES);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.count = 0;
        this.scene.add(this.mesh);
        this._dummy = new THREE.Object3D();
        this._color = new THREE.Color();
    }

    emit(config) {
        if (this.active.length >= MAX_PARTICLES) {
            this._dropLowestPriority();
        }
        const p = {
            x: config.x || 0, y: config.y || 0, z: config.z || 0,
            vx: config.vx || 0, vy: config.vy || 0, vz: config.vz || 0,
            life: config.life || 1.0,
            maxLife: config.life || 1.0,
            r: config.r ?? 1.0, g: config.g ?? 1.0, b: config.b ?? 1.0,
            size: config.size ?? 1.0,
            gravity: config.gravity ?? 0,
            drag: config.drag ?? 0.98,
            priority: config.priority ?? 1
        };
        this.active.push(p);
        return p;
    }

    burst(origin, count, spread, color, speed, life, gravity, priority) {
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const sinPhi = Math.sin(phi);
            const vx = sinPhi * Math.cos(theta) * speed * (0.5 + Math.random() * 0.5);
            const vy = sinPhi * Math.sin(theta) * speed * (0.5 + Math.random() * 0.5);
            const vz = Math.cos(phi) * speed * (0.5 + Math.random() * 0.5);
            const c = typeof color === 'string'
                ? (() => { const tc = new THREE.Color(color); return { r: tc.r, g: tc.g, b: tc.b }; })()
                : { r: color.r, g: color.g, b: color.b };
            this.emit({
                x: origin.x + (Math.random() - 0.5) * spread,
                y: origin.y + (Math.random() - 0.5) * spread,
                z: origin.z + (Math.random() - 0.5) * spread,
                vx, vy, vz,
                life: life || 1.0,
                r: c.r, g: c.g, b: c.b,
                size: 0.5 + Math.random() * 0.5,
                gravity: gravity ?? -5,
                drag: 0.96,
                priority: priority ?? 2
            });
        }
    }

    trail(tail, count, color, fade, speed) {
        for (let i = 0; i < count; i++) {
            const t = i / count;
            const c = typeof color === 'string'
                ? (() => { const tc = new THREE.Color(color); return { r: tc.r, g: tc.g, b: tc.b }; })()
                : { r: color.r, g: color.g, b: color.b };
            this.emit({
                x: tail.x + (Math.random() - 0.5) * 0.1,
                y: tail.y + (Math.random() - 0.5) * 0.1,
                z: tail.z + (Math.random() - 0.5) * 0.1,
                vx: 0, vy: 0, vz: 0,
                life: 0.3 * (1 - t * fade),
                r: c.r, g: c.g, b: c.b,
                size: 0.3 * (1 - t * 0.5),
                gravity: 0,
                drag: 1.0,
                priority: 0
            });
        }
    }

    update(dt) {
        let writeIdx = 0;
        for (let i = 0; i < this.active.length; i++) {
            const p = this.active[i];
            p.life -= dt;
            if (p.life <= 0) continue;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.vz *= p.drag;
            p.vy += p.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            const ratio = p.life / p.maxLife;
            this._dummy.position.set(p.x, p.y, p.z);
            const s = p.size * ratio;
            this._dummy.scale.set(s, s, s);
            this._dummy.updateMatrix();
            this.mesh.setMatrixAt(writeIdx, this._dummy.matrix);
            this._color.setRGB(p.r * ratio, p.g * ratio, p.b * ratio);
            this.mesh.setColorAt(writeIdx, this._color);
            this.active[writeIdx] = p;
            writeIdx++;
        }
        this.active.length = writeIdx;
        this.mesh.count = writeIdx;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    _dropLowestPriority() {
        let minPri = Infinity, minIdx = -1;
        for (let i = 0; i < this.active.length; i++) {
            if (this.active[i].priority < minPri) {
                minPri = this.active[i].priority;
                minIdx = i;
            }
        }
        if (minIdx >= 0) this.active.splice(minIdx, 1);
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.scene.remove(this.mesh);
        this.active.length = 0;
    }
}

export { ParticleManager };
