import * as THREE from 'three';

/**
 * Floating 3D text that rises and fades out.
 * Uses canvas-generated sprite textures (no font loading).
 */
export class FloatingText3D {
  constructor(scene) {
    this.scene = scene;
    this.texts = [];
  }

  /**
   * Spawn a floating text at the given 3D position.
   */
  spawn(position, text, color = '#ffffff', duration = 1.5) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Draw text onto canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 64px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;

    // White core
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(2.0, 1.0, 1.0);

    this.scene.add(sprite);

    this.texts.push({
      sprite,
      texture,
      material,
      startTime: performance.now() / 1000,
      duration,
      startY: position.y,
    });
  }

  update(elapsed) {
    const now = performance.now() / 1000;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      const age = now - t.startTime;
      const progress = age / t.duration;

      if (progress >= 1.0) {
        // Remove and dispose
        this.scene.remove(t.sprite);
        t.sprite.material.dispose();
        t.texture.dispose();
        this.texts.splice(i, 1);
        continue;
      }

      // Rise
      t.sprite.position.y = t.startY + progress * 2.0;

      // Fade out in last 40%
      if (progress > 0.6) {
        t.material.opacity = 1.0 - (progress - 0.6) / 0.4;
      }

      // Scale up slightly then shrink
      const scale = 1.0 + Math.sin(progress * Math.PI) * 0.3;
      t.sprite.scale.set(2.0 * scale, 1.0 * scale, 1.0);
    }
  }

  /**
   * Dispose all floating texts and clean up.
   */
  dispose() {
    for (const t of this.texts) {
      this.scene.remove(t.sprite);
      t.sprite.material.dispose();
      t.texture.dispose();
    }
    this.texts.length = 0;
  }
}
