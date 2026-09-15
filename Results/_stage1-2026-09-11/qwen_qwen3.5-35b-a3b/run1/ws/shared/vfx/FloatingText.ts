/**
 * FloatingText System - Dynamic 3D/HTML score display with physics
 * Part of the AAA Retro-Futurism VFX suite for Space Invaders
 */

import { Vector3, Vector2 } from 'three';

export interface FloatingTextConfig {
  text: string;
  position: Vector3;
  color?: string;
  fontSize?: number;
  duration?: number; // seconds before fade out
  scale?: number;
  velocityY?: number; // initial upward velocity
}

interface TextElement {
  element: HTMLElement;
  position: Vector3;
  velocity: Vector3;
  opacity: number;
  scale: number;
  age: number;
  duration: number;
}

export class FloatingTextSystem {
  private container: HTMLElement;
  private texts: Map<string, TextElement> = new Map();
  private nextId: number = 0;
  
  constructor(containerSelector: string) {
    this.container = document.querySelector(containerSelector)!;
    if (!this.container) {
      console.error('FloatingTextSystem: Container not found:', containerSelector);
      throw new Error('Container element not found');
    }
  }

  spawn(config: FloatingTextConfig): string {
    const id = `ft_${this.nextId++}`;
    
    const textElement = document.createElement('div');
    textElement.id = id;
    textElement.className = 'floating-text';
    textElement.textContent = config.text;
    textElement.style.cssText = `
      position: absolute;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: ${config.color || '#00ff88'};
      font-size: ${config.fontSize || 24}px;
      pointer-events: none;
      text-shadow: 0 0 10px rgba(0, 255, 136, 0.8), 
                   0 0 20px rgba(0, 255, 136, 0.4);
      opacity: 1;
      transform-origin: center bottom;
    `;
    
    this.container.appendChild(textElement);
    
    const textData: TextElement = {
      element: textElement,
      position: config.position.clone(),
      velocity: new Vector3(0, config.velocityY || 50, 0),
      opacity: 1.0,
      scale: config.scale || 1.0,
      age: 0,
      duration: config.duration || 2.0
    };
    
    this.texts.set(id, textData);
    return id;
  }

  update(deltaTime: number): void {
    const now = Date.now();
    const deltaSeconds = deltaTime / 1000;
    
    // Update each floating text element
    for (const [id, data] of this.texts) {
      data.age += deltaSeconds;
      
      // Apply physics: gravity and velocity
      data.position.add(data.velocity.clone().multiplyScalar(deltaSeconds));
      data.velocity.y -= 980 * deltaSeconds; // Gravity: 980 units/s²
      
      // Fade out based on age
      const fadeProgress = Math.min(data.age / data.duration, 1.0);
      data.opacity = 1.0 - fadeProgress;
      
      // Scale down as it rises and fades
      const scaleProgress = Math.min(data.age / (data.duration * 0.7), 1.0);
      const currentScale = data.scale * (1.0 - scaleProgress * 0.3);
      
      // Update DOM element
      if (data.opacity <= 0) {
        data.element.style.display = 'none';
        this.texts.delete(id);
        continue;
      }
      
      data.element.style.opacity = String(data.opacity);
      data.element.style.transform = `scale(${currentScale})`;
    }
    
    // Clean up removed elements from DOM
    const domElementsToRemove: string[] = [];
    for (const [id, data] of this.texts) {
      if (!data.element.isConnected) {
        domElementsToRemove.push(id);
      }
    }
    domElementsToRemove.forEach(id => this.texts.delete(id));
  }

  syncWith3D(camera: any, renderer: any): void {
    for (const [id, data] of this.texts) {
      const element = data.element;
      
      // Project 3D position to 2D screen space
      const vector = data.position.clone();
      vector.project(camera);
      
      const x = (vector.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
      const y = (-(vector.y * 0.5 - 0.5)) * renderer.domElement.clientHeight;
      
      // Only show if in front of camera
      if (vector.z > 1 && vector.z < -1) {
        element.style.display = 'none';
        continue;
      }
      
      element.style.display = 'block';
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    }
  }

  clear(): void {
    for (const [id, data] of this.texts) {
      if (data.element.parentNode) {
        data.element.parentNode.removeChild(data.element);
      }
    }
    this.texts.clear();
  }

  dispose(): void {
    this.clear();
    this.texts = new Map();
  }
}