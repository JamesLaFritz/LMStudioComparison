import { Vector3, Scene } from 'three';

interface FloatingTextEntry {
  element: HTMLElement;
  position: Vector3;
  birthTime: number;
}

export class FloatingText {
  private container: HTMLElement;
  private entries: FloatingTextEntry[] = [];
  private scene: Scene;

  constructor(scene: Scene, parentElement?: HTMLElement) {
    this.scene = scene;
    this.container = parentElement || document.createElement('div');
    if (!parentElement) {
      this.container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;';
      document.body.appendChild(this.container);
    }
  }

  show(position3D: Vector3, text: string, color: string = '#ffffff'): void {
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute;
      font-family:'Courier New',monospace;
      font-size:20px;
      font-weight:bold;
      color:${color};
      text-shadow:0 0 8px ${color},0 0 16px ${color};
      pointer-events:none;
      white-space:nowrap;
    `;
    el.textContent = text;

    const projected = this.projectToScreen(position3D);
    if (projected) {
      el.style.left = `${projected.x}px`;
      el.style.top = `${projected.y}px`;
      el.style.transform = 'translate(-50%, -100%)';
    }

    this.container.appendChild(el);
    const entry: FloatingTextEntry = { element: el, position: position3D.clone(), birthTime: performance.now() };
    this.entries.push(entry);
  }

  private projectToScreen(pos: Vector3): { x: number; y: number } | null {
    // We need camera reference — store it separately or accept as parameter
    return null;
  }

  update(dt: number): void {
    const now = performance.now();
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      const age = (now - entry.birthTime) / 1000;

      if (age > 1.5) {
        if (entry.element.parentNode) {
          entry.element.parentNode.removeChild(entry.element);
        }
        this.entries.splice(i, 1);
        continue;
      }

      const progress = age / 1.5;
      const offsetY = -progress * 60;
      const opacity = Math.max(0, 1 - progress);
      const scale = 1 + Math.sin(progress * Math.PI) * 0.3;

      entry.element.style.transform = `translate(-50%, calc(-100% + ${offsetY}px)) scale(${scale})`;
      entry.element.style.opacity = String(opacity);
    }
  }

  cleanup(): void {
    for (const entry of this.entries) {
      if (entry.element.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
    }
    this.entries.length = 0;
  }

  dispose(): void {
    this.cleanup();
  }
}