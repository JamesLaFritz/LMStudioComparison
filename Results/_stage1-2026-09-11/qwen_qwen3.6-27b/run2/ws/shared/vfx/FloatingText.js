import * as THREE from 'three';
import { clamp } from '../math/MathUtils.js';
import { MemoryTracker } from '../memory/MemoryTracker.js';

export class FloatingText {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.tracker = new MemoryTracker();
  }

  show(position, text, color = '#ffffff', fontSize = 48, duration = 1.5) {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    // Core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    this.tracker.trackTexture(texture);

    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.tracker.trackMaterial(mat);

    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(2.5, 1.25, 1);
    this.scene.add(sprite);

    this.items.push({
      sprite,
      material: mat,
      texture,
      birth: performance.now(),
      duration: duration * 1000,
      startY: position.y,
    });
  }

  update(dt) {
    const now = performance.now();
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const elapsed = now - item.birth;
      const t = clamp(elapsed / item.duration, 0, 1);

      // Fade out in last 40%
      const alpha = t > 0.6 ? 1 - ((t - 0.6) / 0.4) : 1;
      item.material.opacity = alpha;

      // Float upward
      item.sprite.position.y = item.startY + t * 2.5;

      // Scale up slightly then shrink
      const scale = 1 + Math.sin(t * Math.PI) * 0.3;
      item.sprite.scale.set(2.5 * scale, 1.25 * scale, 1);

      if (t >= 1) {
        this.scene.remove(item.sprite);
        item.material.map.dispose();
        item.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const item of this.items) {
      this.scene.remove(item.sprite);
      item.material.map.dispose();
      item.material.dispose();
    }
    this.items.length = 0;
  }

  dispose() {
    this.clear();
    this.tracker.disposeAll();
  }
}
