import * as THREE from 'three';
import { DomPool } from '@shared/ui/DomPool.js';
import { clamp } from '@shared/math/Math2D.js';

export class ScoreTextManager {
  constructor(parent) {
    this.pool = new DomPool(parent, 'score-float', 24);
    this.projected = new THREE.Vector3();
  }

  spawn(x, y, z, value, color) {
    const element = this.pool.acquire();
    if (!element) {
      return;
    }
    element.textContent = '+' + value;
    element.style.color = '#' + color.toString(16).padStart(6, '0');
    element.__scoreX = x;
    element.__scoreY = y;
    element.__scoreZ = z;
    element.__scoreAge = 0;
    element.__scoreLife = 0.85;
  }

  update(delta, camera, width, height) {
    for (let index = 0; index < this.pool.items.length; index += 1) {
      const element = this.pool.items[index];
      if (!element.__poolActive) {
        continue;
      }
      element.__scoreAge += delta;
      if (element.__scoreAge >= element.__scoreLife) {
        this.pool.release(element);
        continue;
      }
      const progress = clamp(element.__scoreAge / element.__scoreLife, 0, 1);
      this.projected.set(element.__scoreX, element.__scoreY + progress * 0.7, element.__scoreZ).project(camera);
      const x = (this.projected.x * 0.5 + 0.5) * width;
      const y = (-this.projected.y * 0.5 + 0.5) * height;
      element.style.transform = 'translate3d(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px, 0) translate(-50%, -50%) scale(' + (1 + progress * 0.24).toFixed(3) + ')';
      element.style.opacity = String(1 - progress);
    }
  }

  dispose() {
    this.pool.dispose();
  }
}
