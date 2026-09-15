/**
 * FloatingText3D — Dynamic 3D/HTML score text overlays
 * Projects world positions to screen coordinates for HTML-based floating text
 */

export class FloatingText3D {
  constructor(uiContainer, camera) {
    this.uiContainer = uiContainer;
    this.camera = camera;
    this.elements = [];
    this.animationId = null;
    
    // Start animation loop
    this.animate();
  }

  /**
   * Spawn floating text at a world position
   * @param {string} text - Text to display (e.g., "+30", "COMBO x2")
   * @param {THREE.Vector3} worldPosition - World coordinates
   * @param {string} color - CSS color string (default: neon green)
   * @param {number} size - Font size in pixels (default: 24)
   * @param {boolean} isLarge - Whether this is a large display text (combo, etc.)
   */
  spawn(text, worldPosition, color = '#00ff88', size = 24, isLarge = false) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    
    // Style configuration
    const baseSize = isLarge ? size * 2 : size;
    el.style.fontSize = `${baseSize}px`;
    el.style.fontWeight = 'bold';
    el.style.color = color;
    el.style.textShadow = `0 0 ${isLarge ? 20 : 10}px ${color}, 0 0 ${isLarge ? 40 : 20}px ${color}`;
    el.style.pointerEvents = 'none';
    el.style.whiteSpace = 'nowrap';
    el.style.zIndex = '1000';
    
    // Initial position (projected)
    const screenPos = this.projectToWorld(worldPosition);
    el.style.left = `${screenPos.x}px`;
    el.style.top = `${screenPos.y}px`;
    
    // Animation properties stored on element
    el.dataset.birthTime = performance.now();
    el.dataset.duration = isLarge ? 1500 : 1000;
    el.dataset.targetY = screenPos.y - (isLarge ? 80 : 40);
    el.dataset.currentY = screenPos.y;
    el.dataset.opacity = '1';
    
    this.uiContainer.appendChild(el);
    this.elements.push({ element: el });
    
    // Auto-removal after animation
    setTimeout(() => {
      if (el.parentNode) {
        el.remove();
      }
      this.elements = this.elements.filter(e => e.element !== el);
    }, parseInt(el.dataset.duration));
  }

  /**
   * Project world position to screen coordinates
   */
  projectToWorld(worldPosition) {
    const vector = worldPosition.clone().project(this.camera);
    
    // Convert NDC to screen pixels
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    
    return { x, y };
  }

  /**
   * Animation loop for floating text
   */
  animate() {
    const now = performance.now();
    
    this.elements.forEach(item => {
      const el = item.element;
      if (!el.parentNode) return; // Already removed
      
      const birthTime = parseFloat(el.dataset.birthTime);
      const duration = parseFloat(el.dataset.duration);
      const targetY = parseFloat(el.dataset.targetY);
      
      const elapsed = now - birthTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out animation for vertical movement
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentY = parseFloat(el.dataset.currentY) * (1 - easeOut) + targetY * easeOut;
      
      // Fade out in last third of animation
      let opacity = 1;
      if (progress > 0.6) {
        opacity = 1 - ((progress - 0.6) / 0.4);
      }
      
      el.style.top = `${currentY}px`;
      el.style.opacity = Math.max(0, opacity);
    });
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Update method for game loop integration (no-op, animation runs via RAF)
   */
  update() {
    // Animation is handled by internal RAF loop
  }

  /**
   * Clear all floating text immediately
   */
  clear() {
    this.elements.forEach(item => {
      if (item.element.parentNode) {
        item.element.remove();
      }
    });
    this.elements = [];
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    this.clear();
    this.uiContainer = null;
    this.camera = null;
  }
}
