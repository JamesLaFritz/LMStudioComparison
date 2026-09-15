import * as THREE from 'three';

export class PowerUps {
  constructor(scene, config, bus) {
    this.scene = scene;
    this.config = config;
    this.bus = bus;
    this.active = [];
    this.geometry = new THREE.OctahedronGeometry(0.15, 1);
    this.materials = {
      shield: new THREE.MeshStandardMaterial({
        color: 0x004444,
        emissive: 0x00ffcc,
        emissiveIntensity: 1.0,
        metalness: 0.5,
        roughness: 0.3
      }),
      rapid: new THREE.MeshStandardMaterial({
        color: 0x444400,
        emissive: 0xffff00,
        emissiveIntensity: 1.0,
        metalness: 0.5,
        roughness: 0.3
      }),
      spread: new THREE.MeshStandardMaterial({
        color: 0x440044,
        emissive: 0xff00ff,
        emissiveIntensity: 1.0,
        metalness: 0.5,
        roughness: 0.3
      })
    };
  }

  spawn(position) {
    if (Math.random() > this.config.powerUpChance) return;
    const types = Object.keys(this.materials);
    const type = types[Math.floor(Math.random() * types.length)];
    const mesh = new THREE.Mesh(this.geometry, this.materials[type]);
    mesh.position.set(position.x, position.y, 0);
    this.scene.add(mesh);
    this.active.push({ mesh, type, time: 0, lifetime: this.config.powerUpLifetime });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const pu = this.active[i];
      pu.time += dt;
      pu.mesh.rotation.y += dt * 3;
      pu.mesh.position.y -= dt * 0.5;
      if (pu.time > pu.lifetime || pu.mesh.position.y < -4) {
        this.scene.remove(pu.mesh);
        this.active.splice(i, 1);
      }
    }
  }

  collect(playerPos) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const pu = this.active[i];
      const dx = pu.mesh.position.x - playerPos.x;
      const dy = pu.mesh.position.y - playerPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.5) {
        this.bus.emit('powerUp', { type: pu.type, position: pu.mesh.position.clone() });
        this.scene.remove(pu.mesh);
        this.active.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  dispose() {
    for (const pu of this.active) {
      this.scene.remove(pu.mesh);
    }
    this.active.length = 0;
    this.geometry.dispose();
    for (const mat of Object.values(this.materials)) {
      mat.dispose();
    }
  }
}
