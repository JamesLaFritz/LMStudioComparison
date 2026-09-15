import * as THREE from 'three';
import { createAlienTexture } from '../../../shared/procedural/TextureGen';

export class Alien {
  constructor(scene, type, x, y, config) {
    this.type = type;
    this.alive = true;
    this.hp = 1;
    this.baseX = x;
    this.baseY = y;
    this.config = config;
    this.time = Math.random() * 100;

    const tex = createAlienTexture(type, 0);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(config.alienTypes[type].color),
      emissiveIntensity: 0.8,
      emissiveMap: tex,
      metalness: 0.3,
      roughness: 0.6,
      transparent: true,
    });
    const geo = new THREE.PlaneGeometry(config.alienSize, config.alienSize);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, y, 0);
    scene.add(this.mesh);

    this._assets = [tex, mat, geo];
  }

  update(dt, globalTime) {
    if (!this.alive) return;
    this.time += dt;
    const bob = Math.sin(this.time * 2 + this.baseX * 0.5) * 0.05;
    this.mesh.position.y = this.baseY + bob;
    this.mesh.position.x = this.baseX;
  }

  get position() {
    return this.mesh.position;
  }

  get halfSize() {
    return this.config.alienSize / 2;
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    for (const a of this._assets) a.dispose?.();
  }
}
