// shared/core/FloatingText.js
// Pooled 3D floating score/damage text. Each sprite owns its own CanvasTexture
// (procedural, no external files). Zero-allocation steady state.
import * as THREE from 'three';

const POOL_SIZE = 12;
const CANVAS_W = 256;
const CANVAS_H = 96;

export class FloatingText {
  constructor(scene) {
    this.scene = scene;
    this.sprites = [];
    this.free = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d');
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.userData = {
        canvas, ctx, texture,
        life: 0, maxLife: 1, vy: 1.2,
      };
      scene.add(sprite);
      this.sprites.push(sprite);
      this.free.push(sprite);
    }
  }

  spawn(text, position, color = '#ffffff', scale = 1.0, life = 0.9) {
    const sprite = this.free.pop();
    if (!sprite) return null;
    const { ctx, canvas, texture } = sprite.userData;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
    ctx.globalAlpha = 1;
    texture.needsUpdate = true;
    sprite.position.copy(position);
    sprite.scale.set(2.2 * scale, 0.825 * scale, 1);
    sprite.visible = true;
    sprite.userData.life = life;
    sprite.userData.maxLife = life;
    return sprite;
  }

  update(dt) {
    for (const sprite of this.sprites) {
      if (!sprite.visible) continue;
      const ud = sprite.userData;
      ud.life -= dt;
      if (ud.life <= 0) {
        sprite.visible = false;
        this.free.push(sprite);
        continue;
      }
      sprite.position.y += ud.vy * dt;
      const t = ud.life / ud.maxLife;
      sprite.material.opacity = t < 0.4 ? t / 0.4 : 1;
    }
  }

  dispose() {
    for (const sprite of this.sprites) {
      this.scene.remove(sprite);
      sprite.userData.texture.dispose();
      sprite.material.dispose();
    }
    this.sprites.length = 0;
    this.free.length = 0;
  }
}
