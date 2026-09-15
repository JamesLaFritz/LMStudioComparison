import * as THREE from 'three';

/**
 * FloatingText — 3D sprite text that floats upward and fades out.
 * Uses canvas textures on planes.
 * spawn(worldPos, text, color, duration).
 */
export class FloatingText {
  constructor(scene) {
    this.scene = scene;
    /** @type {Array<{mesh: THREE.Mesh, birth: number, duration: number, velocity: number}>} */
    this._active = [];
    this._fontCache = new Map(); // cache canvas textures by text+color
  }

  /**
   * Spawn floating text at a world position.
   * @param {THREE.Vector3} worldPos
   * @param {string} text
   * @param {string|number} color - CSS color string or hex
   * @param {number} duration - lifetime in seconds
   * @param {number} velocity - upward float speed (units/sec)
   */
  spawn(worldPos, text, color = '#00ffff', duration = 1.5, velocity = 2) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;

    // Draw text
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    // Second pass for brightness
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(worldPos);
    sprite.position.y += 0.5;
    sprite.scale.set(2, 1, 1);
    this.scene.add(sprite);

    this._active.push({
      mesh: sprite,
      texture,
      birth: performance.now(),
      duration: duration * 1000,
      velocity,
      startPos: worldPos.clone(),
    });
  }

  /**
   * Update all active texts. Call once per frame.
   * @param {number} dt - delta time
   */
  update(dt) {
    const now = performance.now();
    for (let i = this._active.length - 1; i >= 0; i--) {
      const entry = this._active[i];
      const elapsed = now - entry.birth;
      const t = elapsed / entry.duration;

      if (t >= 1) {
        entry.mesh.material.map.dispose();
        entry.mesh.material.dispose();
        this.scene.remove(entry.mesh);
        this._active.splice(i, 1);
        continue;
      }

      // Float upward
      entry.mesh.position.y = entry.startPos.y + 0.5 + entry.velocity * elapsed / 1000;

      // Fade out in last 40% of life
      if (t > 0.6) {
        const fadeT = (t - 0.6) / 0.4;
        entry.mesh.material.opacity = 1 - fadeT;
      }

      // Scale pulse at start
      if (t < 0.15) {
        const pulse = 1 + 0.3 * Math.sin(t / 0.15 * Math.PI);
        entry.mesh.scale.set(2 * pulse, pulse, 1);
      }
    }
  }

  /** Dispose everything */
  dispose() {
    for (const entry of this._active) {
      entry.mesh.material.map.dispose();
      entry.mesh.material.dispose();
      this.scene.remove(entry.mesh);
    }
    this._active.length = 0;
  }
}
