import * as THREE from 'three';
import type { Vector3f } from '../types.js';

interface FloatingScoreEntry {
  element: HTMLElement;
  position: Vector3f;
  velocity: Vector3f;
  life: number;
  maxLife: number;
}

export class FloatingScoreText {
  private container: HTMLElement;
  private entries: FloatingScoreEntry[] = [];
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
    this.scene = scene;
    this.camera = camera;
    this.container = document.getElementById('hud-overlay') || document.body;
  }

  spawn(position: Vector3f, score: number): void {
    const el = document.createElement('div');
    el.className = 'floating-score';
    el.textContent = `+${score}`;
    el.style.left = `${position.x}px`;
    el.style.top = `${position.y}px`;
    this.container.appendChild(el);

    this.entries.push({
      element: el,
      position: { x: position.x, y: position.y, z: 0 },
      velocity: { x: 0, y: 60, z: 0 },
      life: 1.0,
      maxLife: 1.0,
    });
  }

  update(dt: number): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      entry.life -= dt;
      entry.position.y += entry.velocity.y * dt;

      if (entry.life <= 0) {
        entry.element.remove();
        this.entries.splice(i, 1);
      } else {
        const opacity = Math.max(0, entry.life / entry.maxLife);
        entry.element.style.opacity = String(opacity);
        // Project 3D position to screen space for smooth follow
        const vec = new THREE.Vector3(entry.position.x, entry.position.y, 0.5);
        vec.project(this.camera);
        const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vec.y * 0.5 + 0.5) * window.innerHeight;
        entry.element.style.left = `${x}px`;
        entry.element.style.top = `${y - 20}px`;
      }
    }
  }

  dispose(): void {
    this.entries.forEach(e => e.element.remove());
    this.entries = [];
  }
}
