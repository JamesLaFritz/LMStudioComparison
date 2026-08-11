/**
 * FloatingText3D — Dynamic 3D score popups.
 * Shared across all games.
 */
import * as THREE from 'three';

export class FloatingText3D {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.texts = [];
  }

  /**
   * Spawn floating text at a position.
   * @param {string} text - The text to display.
   * @param {THREE.Vector3} position - World position.
   * @param {object} [options]
   */
  spawn(text, position, options = {}) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;

    // Style
    const fontSize = options.fontSize || 64;
    const color = options.color || '#00ffcc';
    const glowColor = options.glowColor || '#00ffcc';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    // Second pass for stronger glow
    ctx.shadowBlur = 40;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const aspect = canvas.width / canvas.height;
    const spriteHeight = options.height || 0.8;
    const spriteWidth = spriteHeight * aspect;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(spriteWidth, spriteHeight, 1);

    this.scene.add(sprite);

    this.texts.push({
      sprite,
      texture,
      material,
      velocity: new THREE.Vector3(0, options.riseSpeed || 2, 0),
      life: options.duration || 1.2,
      maxLife: options.duration || 1.2,
    });
  }

  /**
   * Update all floating texts. Call each frame.
   * @param {number} dt - Delta time.
   */
  update(dt) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;

      if (t.life <= 0) {
        this.scene.remove(t.sprite);
        t.texture.dispose();
        t.material.dispose();
        this.texts.splice(i, 1);
        continue;
      }

      // Rise
      t.sprite.position.addScaledVector(t.velocity, dt);

      // Fade out
      const lifeRatio = t.life / t.maxLife;
      t.material.opacity = lifeRatio;

      // Scale up slightly then shrink
      const scalePulse = 1 + Math.sin((1 - lifeRatio) * Math.PI) * 0.2;
      const baseScale = t.sprite.scale.y;
      t.sprite.scale.setScalar(baseScale * scalePulse);
    }
  }

  /**
   * Dispose all floating texts.
   */
  dispose() {
    for (const t of this.texts) {
      this.scene.remove(t.sprite);
      t.texture.dispose();
      t.material.dispose();
    }
    this.texts.length = 0;
  }
}
