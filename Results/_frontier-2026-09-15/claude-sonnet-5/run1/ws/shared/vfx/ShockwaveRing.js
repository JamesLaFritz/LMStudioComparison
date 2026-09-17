import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';

const RING_SEGMENTS = 48;

/**
 * Pooled expanding emissive rings for impacts/deaths. All rings share one
 * thin-ring geometry and animate purely via mesh scale + material opacity,
 * so growth never touches vertex data.
 */
export class ShockwaveRing {
  constructor(scene, { poolSize = 16, disposer = null } = {}) {
    this._scene = scene;
    this._disposer = disposer;

    this._sharedGeometry = new THREE.RingGeometry(0.85, 1, RING_SEGMENTS);
    this._sharedGeometry.rotateX(-Math.PI / 2);
    disposer?.trackGeometry(this._sharedGeometry);

    this._allInstances = [];
    this._activeRings = [];

    this._pool = new ObjectPool(
      () => this._createInstance(),
      (instance) => this._resetInstance(instance),
      poolSize
    );
  }

  _createInstance() {
    const material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0
    });
    this._disposer?.trackMaterial(material);

    const mesh = new THREE.Mesh(this._sharedGeometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    this._scene.add(mesh);

    const instance = { mesh, material, life: 0, duration: 1, maxRadius: 3, minRadius: 0.2 };
    this._allInstances.push(instance);
    return instance;
  }

  _resetInstance(instance) {
    instance.mesh.visible = false;
    instance.material.opacity = 0;
    instance.life = 0;
  }

  spawn({ x, y = 0.05, z, color = 0xffffff, maxRadius = 3, minRadius = 0.2, duration = 0.6 }) {
    const instance = this._pool.acquire();
    instance.mesh.visible = true;
    instance.mesh.position.set(x, y, z);
    instance.material.emissive.set(color);
    instance.material.opacity = 1;
    instance.life = 0;
    instance.duration = duration;
    instance.maxRadius = maxRadius;
    instance.minRadius = minRadius;
    instance.mesh.scale.setScalar(minRadius);
    this._activeRings.push(instance);
  }

  update(dt) {
    for (let i = this._activeRings.length - 1; i >= 0; i--) {
      const instance = this._activeRings[i];
      instance.life += dt;
      const t = Math.min(instance.life / instance.duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const radius = instance.minRadius + (instance.maxRadius - instance.minRadius) * eased;
      instance.mesh.scale.setScalar(radius);
      instance.material.opacity = 1 - t;

      if (t >= 1) {
        this._activeRings.splice(i, 1);
        this._pool.release(instance);
      }
    }
  }

  dispose() {
    for (const instance of this._allInstances) {
      this._scene.remove(instance.mesh);
    }
    this._allInstances.length = 0;
    this._activeRings.length = 0;
  }
}
