import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';

const _ndc = new THREE.Vector3();

/**
 * Pooled floating score/combo text. Implemented as absolutely-positioned DOM
 * nodes projected from world space each frame — cheaper than a 3D sprite
 * texture per popup and fits the HTML/CSS glassmorphism UI layer directly.
 */
export class FloatingText {
  constructor(container, camera, { poolSize = 24 } = {}) {
    this._container = container;
    this._camera = camera;
    this._active = [];
    this._allInstances = [];

    this._pool = new ObjectPool(
      () => this._createInstance(),
      (instance) => this._resetInstance(instance),
      poolSize
    );
  }

  _createInstance() {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.display = 'none';
    el.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
    el.style.fontWeight = '700';
    el.style.zIndex = '20';
    this._container.appendChild(el);

    const instance = {
      el,
      worldX: 0,
      worldY: 0,
      worldZ: 0,
      life: 0,
      duration: 1,
      riseSpeed: 1
    };
    this._allInstances.push(instance);
    return instance;
  }

  _resetInstance(instance) {
    instance.el.style.opacity = '0';
    instance.el.style.display = 'none';
  }

  spawn({ x, y, z, text, color = '#ffffff', fontSize = 18, duration = 0.8, riseSpeed = 1.2 }) {
    const instance = this._pool.acquire();
    instance.worldX = x;
    instance.worldY = y;
    instance.worldZ = z;
    instance.life = 0;
    instance.duration = duration;
    instance.riseSpeed = riseSpeed;

    instance.el.textContent = text;
    instance.el.style.color = color;
    instance.el.style.fontSize = `${fontSize}px`;
    instance.el.style.textShadow = `0 0 8px ${color}, 0 0 18px ${color}`;
    instance.el.style.display = 'block';
    instance.el.style.opacity = '1';

    this._active.push(instance);
  }

  update(dt) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = this._active.length - 1; i >= 0; i--) {
      const instance = this._active[i];
      instance.life += dt;
      const t = Math.min(instance.life / instance.duration, 1);

      const worldY = instance.worldY + t * instance.riseSpeed;
      _ndc.set(instance.worldX, worldY, instance.worldZ).project(this._camera);

      const screenX = (_ndc.x * 0.5 + 0.5) * w;
      const screenY = (1 - (_ndc.y * 0.5 + 0.5)) * h;

      instance.el.style.left = `${screenX}px`;
      instance.el.style.top = `${screenY}px`;
      instance.el.style.opacity = String(1 - t);

      if (t >= 1) {
        this._active.splice(i, 1);
        this._pool.release(instance);
      }
    }
  }

  dispose() {
    for (const instance of this._allInstances) {
      instance.el.remove();
    }
    this._allInstances.length = 0;
    this._active.length = 0;
  }
}
