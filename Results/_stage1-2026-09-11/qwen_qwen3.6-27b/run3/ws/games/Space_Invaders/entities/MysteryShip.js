import * as THREE from 'three';

export class MysteryShip {
  constructor(scene, config, bus) {
    this.scene = scene;
    this.config = config;
    this.bus = bus;
    this.active = false;
    this.mesh = null;
    this.x = 0;
    this.y = config.mysteryShip.y;
    this.speed = config.mysteryShip.speed;
    this.direction = 1;
    this.points = 300;
    this.spawnTimer = 0;
    this.spawnInterval = config.mysteryShip.spawnIntervalMin + Math.random() * (config.mysteryShip.spawnIntervalMax - config.mysteryShip.spawnIntervalMin);
    this._material = null;
    this._geometry = null;
    this._createMesh();
  }

  _createMesh() {
    const geo = new THREE.SphereGeometry(0.3, 8, 6);
    geo.scale(1.5, 0.5, 1);
    this._geometry = geo;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x440044,
      emissive: 0xff00ff,
      emissiveIntensity: 1.0,
      metalness: 0.8,
      roughness: 0.2
    });
    this._material = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  update(dt) {
    if (!this.active) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawn();
      }
      return;
    }
    this.x += this.speed * this.direction * dt;
    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.rotation.y += dt * 2;
    if (Math.abs(this.x) > 7) {
      this.deactivate();
    }
  }

  spawn() {
    this.active = true;
    this.points = [300, 500, 700][Math.floor(Math.random() * 3)];
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.x = this.direction > 0 ? -7 : 7;
    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.visible = true;
    this.bus.emit('ufo_appear', {});
  }

  destroy() {
    this.bus.emit('ufo_destroyed', { x: this.x, y: this.y, points: this.points });
    this.deactivate();
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
    this.spawnTimer = 0;
    this.spawnInterval = this.config.mysteryShip.spawnIntervalMin + Math.random() * (this.config.mysteryShip.spawnIntervalMax - this.config.mysteryShip.spawnIntervalMin);
  }

  get position() {
    return this.mesh.position;
  }

  get halfSize() {
    return 0.5;
  }

  getPosition() {
    return { x: this.x, y: this.y };
  }

  getActive() {
    return this.active;
  }

  isOffScreen() {
    return Math.abs(this.x) > 7;
  }

  dispose() {
    if (this._geometry) this._geometry.dispose();
    if (this._material) this._material.dispose();
    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}
