// Floating Text Manager - 3D Billboard + HTML Hybrid System
import * as THREE from 'three';

export class FloatingTextManager {
  constructor(scene) {
    this.scene = scene;
    this.texts = []; // Active 3D text sprites
    this.canvasPool = []; // Reuse canvases for textures
    
    // HTML container for DOM-based floating text option
    this.htmlContainer = document.createElement('div');
    this.htmlContainer.id = 'floating-text-container';
    this.htmlContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      overflow: hidden;
    `;
    document.body.appendChild(this.htmlContainer);
    
    // Pre-create some canvases for the pool
    for (let i = 0; i < 20; i++) {
      this.canvasPool.push(this.createCanvas());
    }
  }
  
  createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    return canvas;
  }
  
  /**
   * Spawn a 3D billboard sprite that always faces the camera
   * @param {THREE.Vector3} position - World space position
   * @param {string} text - Text to display
   * @param {string|number} color - Color in hex or CSS format
   * @param {number} size - Font size in pixels
   * @param {number} lifetime - How long the text stays visible (seconds)
   */
  spawn3D(position, text, color = '#00ff00', size = 24, lifetime = 1.5) {
    const canvas = this.getCanvas();
    const ctx = canvas.getContext('2d');
    
    // Clear with transparency
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw text shadow for glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    
    // Draw the text
    ctx.font = `bold ${size}px Arial`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create sprite material with additive blending for glow
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    // Create sprite (billboard always faces camera)
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(3, 1.5, 1); // Adjust for aspect ratio
    
    // Store metadata for animation
    this.texts.push({
      mesh: sprite,
      texture: texture,
      material: material,
      lifetime: lifetime,
      maxLifetime: lifetime,
      velocityY: 0.3 + Math.random() * 0.2, // Slight variation in rise speed
      canvas: canvas
    });
    
    this.scene.add(sprite);
  }
  
  /**
   * Spawn HTML-based floating text at screen coordinates
   * @param {number} screenX - X position on screen (pixels)
   * @param {number} screenY - Y position from bottom (pixels)
   * @param {string} text - Text to display
   * @param {string|number} color - Color for the text
   */
  spawnHTML(screenX, screenY, text, color = '#00ff00') {
    const el = document.createElement('div');
    
    // Apply glassmorphism neon style
    el.style.cssText = `
      position: absolute;
      left: ${screenX}px;
      bottom: ${screenY}px;
      font-family: 'Arial Black', 'Impact', sans-serif;
      font-size: 28px;
      font-weight: bold;
      color: ${color};
      text-shadow: 
        0 0 10px ${color},
        0 0 20px ${color},
        0 0 30px ${color};
      pointer-events: none;
      white-space: nowrap;
      transform: translateX(-50%);
    `;
    
    el.textContent = text;
    this.htmlContainer.appendChild(el);
    
    // Animate with Web Animations API
    const animation = el.animate([
      { 
        opacity: 1, 
        transform: 'translateX(-50%) translateY(0) scale(1)',
        fontSize: '28px'
      },
      { 
        opacity: 0.5, 
        transform: 'translateX(-50%) translateY(-40px) scale(1.2)',
        fontSize: '36px',
        offset: 0.5
      },
      { 
        opacity: 0, 
        transform: 'translateX(-50%) translateY(-80px) scale(1.5)',
        fontSize: '44px'
      }
    ], {
      duration: 1200,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });
    
    // Auto-remove after animation completes
    animation.onfinish = () => {
      el.remove();
    };
  }
  
  /**
   * Update all active 3D floating text sprites
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const ft = this.texts[i];
      
      // Move upward
      ft.mesh.position.y += ft.velocityY * dt;
      
      // Decrease lifetime
      ft.lifetime -= dt;
      
      // Calculate opacity based on remaining lifetime (fade out in last 30%)
      const lifeRatio = ft.lifetime / ft.maxLifetime;
      if (lifeRatio > 0.7) {
        ft.mesh.material.opacity = 1.0 - ((1 - lifeRatio) / 0.3);
      } else {
        ft.mesh.material.opacity = lifeRatio * (1 / 0.7);
      }
      
      // Slight scale increase as it rises
      const scale = 1 + (1 - lifeRatio) * 0.5;
      ft.mesh.scale.set(3 * scale, 1.5 * scale, 1);
      
      // Remove when lifetime expires
      if (ft.lifetime <= 0) {
        this.removeText(ft);
      }
    }
  }
  
  /**
   * Remove a floating text sprite and clean up resources
   */
  removeText(ft) {
    this.scene.remove(ft.mesh);
    
    // Dispose material and texture
    if (ft.material) {
      ft.material.dispose();
    }
    if (ft.texture) {
      ft.texture.dispose();
      ft.texture.image = null;
    }
    
    // Return canvas to pool
    if (ft.canvas && this.canvasPool.length < 50) {
      this.canvasPool.push(ft.canvas);
    }
    
    // Remove from active array
    const index = this.texts.indexOf(ft);
    if (index > -1) {
      this.texts.splice(index, 1);
    }
  }
  
  /**
   * Get a canvas from the pool or create a new one
   */
  getCanvas() {
    if (this.canvasPool.length > 0) {
      return this.canvasPool.pop();
    }
    return this.createCanvas();
  }
  
  /**
   * Clear all floating text immediately
   */
  clearAll() {
    while (this.texts.length > 0) {
      const ft = this.texts[0];
      this.removeText(ft);
    }
    
    // Clear HTML container
    while (this.htmlContainer.firstChild) {
      this.htmlContainer.removeChild(this.htmlContainer.firstChild);
    }
  }
  
  /**
   * Dispose the manager and clean up all resources
   */
  dispose() {
    this.clearAll();
    
    // Return all canvases to browser
    for (const canvas of this.canvasPool) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.canvasPool = [];
    
    // Remove HTML container
    if (this.htmlContainer.parentNode) {
      this.htmlContainer.remove();
    }
  }
}
