import * as THREE from 'three';

export class FloatingScoreText {
  constructor(scene) {
    this.scene = scene;
    this.texts = [];
    this.font = 'bold 32px "Courier New", monospace';
  }

  spawn(position, text, color = '#ffffff') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.font = this.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 64);
    ctx.fillText(text, 128, 64);

    // Core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(1.2, 0.6, 1);

    this.scene.add(sprite);

    this.texts.push({
      sprite,
      material,
      texture,
      life: 1.5,
      maxLife: 1.5,
      baseY: position.y,
      scalePhase: 0
    });
  }

  update(dt) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.sprite);
        t.material.map.dispose();
        t.material.dispose();
        this.texts.splice(i, 1);
        continue;
      }

      const progress = 1 - t.life / t.maxLife;
      t.sprite.position.y = t.baseY + progress * 0.8;
      t.material.opacity = 1 - progress;
      t.scalePhase += dt * 4;
      const s = 1 + Math.sin(t.scalePhase) * 0.15 * (1 - progress);
      t.sprite.scale.set(1.2 * s, 0.6 * s, 1);
    }
  }

  dispose() {
    for (const t of this.texts) {
      this.scene.remove(t.sprite);
      t.material.map.dispose();
      t.material.dispose();
    }
    this.texts.length = 0;
  }
}
