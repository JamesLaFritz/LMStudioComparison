/**
 * Floating Score Text Manager
 * 
 * Manages floating score text effects that rise and fade from kill locations.
 * Uses both 3D particle rendering (via Three.js) and HTML overlay sync for crisp display.
 * All text elements are pooled to prevent GC pressure.
 */

import { vec3 } from '../utils/math.js';
import { EffectComposer, RenderPass } from 'three/addons/postprocessing/EffectComposer.js';

/**
 * FloatingScoreText represents a single floating score text effect.
 * Each instance has both a 3D particle representation and an HTML overlay element.
 */
export class FloatingScoreText {
  constructor(x, y, z, value, color = '#ffffff', duration = 1.0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.value = value;
    this.color = color;
    this.duration = duration;
    this.elapsed = 0;
    this.alive = true;

    // Create 3D particle representation (small cube with text material)
    const geometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const texture = new THREE.CanvasTexture();
    texture.width = 64;
    texture.height = 64;
    const ctx = texture.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), 32, 32);
    texture.update();

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: color,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.y = Math.PI / 2; // Face forward

    // Create HTML overlay element
    this.domElement = document.createElement('div');
    this.domElement.className = 'floating-score-text';
    this.domElement.textContent = value;
    this.domElement.style.color = color;
    this.domElement.style.textShadow = `0 0 ${15 + (duration - this.elapsed) * 20}px ${color}`;
    this.domElement.style.position = 'absolute';
    this.domElement.style.pointerEvents = 'none';
    this.domElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
    this.domElement.style.opacity = '1';
    this.domElement.style.transform = `translate(-50%, -50%)`;

    // Store reference to parent container for DOM management
    if (!window.scoreTextContainer) {
      window.scoreTextContainer = document.createElement('div');
      window.scoreTextContainer.id = 'score-text-container';
      window.scoreTextContainer.style.position = 'fixed';
      window.scoreTextContainer.style.pointerEvents = 'none';
      window.scoreTextContainer.style.zIndex = '100';
      document.body.appendChild(window.scoreTextContainer);
    }

    this.domElement.style.width = '64px';
    this.domElement.style.height = '64px';
  }

  update(dt, camera) {
    if (!this.alive) return;

    this.elapsed += dt;

    // Calculate screen position from world position
    const screenPos = new THREE.Vector2();
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -camera.position.y + camera.position.z);
    const screenSpace = new THREE.Vector3();
    camera.project(this.mesh.position.clone(), screenSpace);

    // Convert to normalized screen coordinates (-1 to 1)
    const x = (screenSpace.x / screenSpace.w) * 0.5 + 0.5;
    const y = (screenSpace.y / screenSpace.w) * 0.5 + 0.5;

    // Update HTML overlay position and opacity
    this.domElement.style.left = `${x * window.innerWidth}px`;
    this.domElement.style.top = `${y * window.innerHeight}px`;
    this.domElement.style.opacity = Math.max(0, 1 - this.elapsed / this.duration);
    this.domElement.style.transform = `translate(-50%, -50%) scale(${1 + (1 - this.elapsed / this.duration) * 0.3})`;

    // Update 3D mesh position and opacity
    const riseAmount = (1 - this.elapsed / this.duration) * 20;
    this.mesh.position.y += dt * 400;
    this.mesh.material.opacity = Math.max(0, 1 - this.elapsed / this.duration);

    // Check if text has expired
    if (this.elapsed >= this.duration) {
      this.alive = false;
      this.domElement.remove();
      this.mesh.visible = false;
    }
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh.material.map.dispose();
      this.mesh.delete();
    }
    if (this.domElement) {
      this.domElement.remove();
    }
  }
}

/**
 * FloatingScoreTextManager manages all floating score text effects.
 * Uses object pooling for the 3D particle representations and DOM management
 * for the HTML overlay elements.
 */
export class FloatingScoreTextManager {
  constructor(maxParticles = 50) {
    this.maxParticles = maxParticles;
    this.pools = []; // Pool of reusable FloatingScoreText instances
    this.activeCount = 0;

    // Create initial pool
    for (let i = 0; i < maxParticles; i++) {
      const text = new FloatingScoreText(0, 0, 0, 0, '#ffffff', 1.0);
      text.alive = false;
      this.pools.push(text);
    }
  }

  /**
   * Spawn a floating score text effect at the given world position.
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @param {number} z - World Z coordinate
   * @param {string|number} value - Score value to display
   * @param {string} color - Text color (hex)
   * @param {number} duration - Display duration in seconds
   */
  spawn(x, y, z, value, color = '#ffffff', duration = 1.0) {
    if (this.activeCount >= this.maxParticles) return;

    // Find an available pooled instance or create a new one
    let textInstance;
    for (let i = 0; i < this.pools.length; i++) {
      const instance = this.pools[i];
      if (!instance.alive) {
        textInstance = instance;
        break;
      }
    }

    if (!textInstance) {
      textInstance = new FloatingScoreText(x, y, z, value, color, duration);
      this.pools.push(textInstance);
    }

    // Reset the instance
    textInstance.x = x;
    textInstance.y = y;
    textInstance.z = z;
    textInstance.value = String(value);
    textInstance.color = color;
    textInstance.duration = duration;
    textInstance.elapsed = 0;
    textInstance.alive = true;

    // Reset mesh position and opacity
    textInstance.mesh.position.set(x, y, z);
    textInstance.mesh.visible = true;
    textInstance.mesh.material.opacity = 1.0;

    // Update DOM element styling
    textInstance.domElement.style.color = color;
    textInstance.domElement.textContent = String(value);
    textInstance.domElement.style.opacity = '1';

    this.activeCount++;
  }

  /**
   * Update all active floating score text effects.
   * @param {number} dt - Delta time in seconds
   * @param {THREE.Camera} camera - The main camera for projection calculations
   */
  update(dt, camera) {
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const textInstance = this.pools[i];
      if (!textInstance.alive) continue;

      textInstance.update(dt, camera);

      // Remove dead instances from pool to keep it clean
      if (!textInstance.alive) {
        this.pools.splice(i, 1);
        this.activeCount--;
      }
    }
  }

  /**
   * Dispose all pooled instances and clear the DOM container.
   */
  dispose() {
    for (const textInstance of this.pools) {
      textInstance.dispose();
    }
    this.pools.length = 0;
    this.activeCount = 0;

    if (window.scoreTextContainer) {
      window.scoreTextContainer.innerHTML = '';
      window.scoreTextContainer.remove();
    }
  }
}