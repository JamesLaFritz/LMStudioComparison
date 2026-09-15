import * as THREE from 'three';

export class BossAlien {
    constructor(scene, config, bus) {
        this.scene = scene;
        this.config = config;
        this.bus = bus;
        this.alive = false;
        this.hp = 0;
        this.maxHp = config.bossMaxHp;
        this.fireTimer = 0;
        this.fireInterval = 0.4;
        this.moveTimer = 0;
        this.moveDir = 1;
        this.mesh = null;
        this.group = null;
        this.baseY = 2.8;
        this.x = 0;
        this.y = this.baseY;
        this._createMesh();
    }

    _createMesh() {
        this.group = new THREE.Group();
        const geo = new THREE.BoxGeometry(1.2, 0.8, 0.6);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x220022,
            emissive: 0xff0066,
            emissiveIntensity: 1.0,
            metalness: 0.5,
            roughness: 0.3
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.group.add(this.mesh);

        const eyeGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 2.0
        });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.3, 0.1, 0.3);
        this.group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.3, 0.1, 0.3);
        this.group.add(rightEye);

        this.group.visible = false;
        this.scene.add(this.group);
    }

    spawn() {
        this.alive = true;
        this.hp = this.maxHp;
        this.x = 0;
        this.y = this.baseY;
        this.fireTimer = 0;
        this.moveTimer = 0;
        this.moveDir = 1;
        this.group.visible = true;
        this.group.position.set(this.x, this.y, 0);
        this.mesh.material.emissiveIntensity = 1.0;
    }

    update(dt) {
        if (!this.alive) return;
        this.moveTimer += dt;
        if (this.moveTimer > 0.5) {
            this.moveTimer = 0;
            this.x += this.moveDir * 2.0;
            if (this.x > 4.5 || this.x < -4.5) {
                this.moveDir *= -1;
            }
            this.group.position.x = this.x;
        }
        this.y = this.baseY + Math.sin(performance.now() * 0.002) * 0.2;
        this.group.position.y = this.y;
        this.fireTimer += dt;
        if (this.fireTimer >= this.fireInterval) {
            this.fireTimer = 0;
            this._fire();
        }
        const flash = (this.hp / this.maxHp) < 0.3 ? 0.5 + Math.sin(performance.now() * 0.01) * 0.5 : 0;
        this.mesh.material.emissiveIntensity = 1.0 + flash;
    }

    _fire() {
        this.bus.emit('boss_fire', { x: this.x, y: this.y });
    }

    takeDamage() {
        if (!this.alive) return;
        this.hp--;
        this.bus.emit('boss_hit', { x: this.x, y: this.y });
        if (this.hp <= 0) {
            this.alive = false;
            this.group.visible = false;
            this.bus.emit('boss_death', { x: this.x, y: this.y });
        }
    }

    get position() {
        return new THREE.Vector3(this.x, this.y, 0);
    }

    get halfSize() {
        return 0.6;
    }

    getHitbox() {
        if (!this.alive) return null;
        return {
            minX: this.x - 0.6,
            maxX: this.x + 0.6,
            minY: this.y - 0.4,
            maxY: this.y + 0.4
        };
    }

    dispose() {
        this.scene.remove(this.group);
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
}
