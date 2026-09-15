import * as THREE from 'three';

export class FloatingTextManager {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.texts = []; // active floating texts
    this.maxTexts = 20;
    
    // Container for Three.js sprites
    this.container = new THREE.Group();
    scene.add(this.container);
    
    // HTML overlay for crisp rendering
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      pointer-events: none;
      font-family: 'Courier New', monospace, sans-serif;
      font-weight: bold;
      text-shadow: 0 0 10px #00ffff, 0 0 20px #ff00ff;
      z-index: 9999;
    `;
    document.body.appendChild(this.overlay);
    
    // Reusable canvas for texture generation
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  spawnText(position, points) {
    if (this.texts.length >= this.maxTexts) return;
    
    const textData = {
      element: null, // HTML element
      sprite: null, // Three.js sprite for parallax
      position: position.clone(),
      velocityY: 2.0, // float upward speed
      lifetime: 120, // frames at 60fps
      points: points
    };
    
    // Create HTML element
    const el = document.createElement('div');
    el.textContent = `+${points}`;
    el.style.cssText = `
      color: #ffff00;
      font-size: 24px;
      opacity: 1.0;
      transform: translate(-50%, -50%);
      white-space: nowrap;
    `;
    
    // Create Three.js sprite
    const texture = this.createTextTexture(`+${points}`);
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      color: 0xffff00,
      transparent: true,
      opacity: 1.0
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(2, 1, 1);
    sprite.userData.id = Date.now() + Math.random(); // unique ID
    
    textData.element = el;
    textData.sprite = sprite;
    
    this.container.add(sprite);
    this.texts.push(textData);
  }

  updateTexts(deltaTime) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      
      // Move upward
      t.position.y += t.velocityY * deltaTime;
      t.sprite.position.copy(t.position);
      
      // Fade out
      t.lifetime -= deltaTime * 60; // normalize to frames
      const alpha = Math.max(0, t.lifetime / 120);
      t.element.style.opacity = alpha;
      t.sprite.material.opacity = alpha;
      
      if (t.lifetime <= 0) {
        this.container.remove(t.sprite);
        t.sprite.material.map.dispose();
        t.sprite.material.dispose();
        t.element.remove();
        this.texts.splice(i, 1);
      }
    }
    
    // Sync HTML positions to screen space
    const rendererSize = new THREE.Vector2();
    this.renderer.getSize(rendererSize);
    
    for (const t of this.texts) {
      const screenPos = t.sprite.position.clone().project(this.camera);
      const x = (screenPos.x * 0.5 + 0.5) * rendererSize.width;
      const y = (-screenPos.y * 0.5 + 0.5) * rendererSize.height;
      
      t.element.style.left = `${x}px`;
      t.element.style.top = `${y}px`;
    }
  }

  createTextTexture(text) {
    this.canvas.width = 256;
    this.canvas.height = 64;
    
    // Clear canvas
    this.ctx.fillStyle = 'transparent';
    this.ctx.fillRect(0, 0, 256, 64);
    
    // Draw text with glow effect
    this.ctx.font = 'bold 32px Courier New, monospace';
    this.ctx.fillStyle = '#ffff00';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, 128, 32);
    
    // Add outer glow via shadow
    this.ctx.shadowColor = '#00ffff';
    this.ctx.shadowBlur = 15;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(text, 128, 32);
    
    const texture = new THREE.CanvasTexture(this.canvas);
    texture.needsUpdate = true;
    return texture;
  }

  dispose() {
    this.container.clear();
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.remove();
    }
    this.canvas = null;
    this.ctx = null;
  }
}