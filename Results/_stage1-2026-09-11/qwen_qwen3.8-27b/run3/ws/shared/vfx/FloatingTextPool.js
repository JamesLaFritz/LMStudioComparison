/**
 * FloatingTextPool — pooled floating score/damage text.
 *
 * Two render modes:
 *   '3d'   — canvas-texture sprites in the scene (rise + fade).
 *   'html' — DOM elements projected to screen space (crisper, for banners).
 *
 * Both pools are fixed-size; saturated spawns steal the oldest live entry.
 */
import * as THREE from 'three';
import { clamp, lerp, randRange } from '../math/Utils.js';

const TEXT_W = 256;
const TEXT_H = 96;

function drawLabel(canvas, text, color, sizePx) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, TEXT_W, TEXT_H);
  ctx.font = `700 ${sizePx}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, TEXT_W / 2, TEXT_H / 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(text, TEXT_W / 2, TEXT_H / 2);
}

class FloatingTextPool {
  /**
   * @param {THREE.Scene} scene
   * @param {object} opts { htmlContainer?: HTMLElement, size3d?: number }
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.size3d = opts.size3d ?? 1.0;
    this.htmlContainer = opts.htmlContainer || null;
    this.registry = opts.registry || null;

    this._sprites = [];
    this._html = [];
    this._time = 0;
    this._v3 = new THREE.Vector3();

    const spriteGeo = new THREE.PlaneGeometry(1, 1);
    const spriteMat = new THREE.SpriteMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    if (this.registry) {
      this.registry.track(spriteGeo);
      this.registry.track(spriteMat);
    }
    for (let i = 0; i < 12; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = TEXT_W;
      canvas.height = TEXT_H;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(spriteMat.clone());
      sprite.material.map = texture;
      sprite.scale.set(2.2, 0.83, 1);
      sprite.visible = false;
      sprite.renderOrder = 999;
      scene.add(sprite);
      this._sprites.push({
        sprite, canvas, texture,
        life: 0, maxLife: 1, y0: 0, active: false,
      });
    }

    if (this.htmlContainer) {
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.className = 'float-text-html';
        el.style.display = 'none';
        this.htmlContainer.appendChild(el);
        this._html.push({ el, life: 0, maxLife: 1, active: false, y0: 0 });
      }
    }
  }

  /**
   * Spawn floating text.
   * @param {object} o { text, position: THREE.Vector3, color?: string,
   *                     size?: number, life?: number, mode?: '3d'|'html' }
   */
  spawn(o) {
    const mode = o.mode || '3d';
    if (mode === 'html' && this.htmlContainer) {
      this._spawnHtml(o);
    } else {
      this._spawn3d(o);
    }
  }

  _spawn3d(o) {
    let entry = this._sprites.find((s) => !s.active);
    if (!entry) {
      // steal the oldest (least remaining life)
      entry = this._sprites.reduce((a, b) =>
        (a.life / a.maxLife) < (b.life / b.maxLife) ? a : b);
    }
    const color = o.color || '#7df9ff';
    const sizePx = clamp(Math.round(40 * (o.size || 1)), 24, 84);
    drawLabel(entry.canvas, o.text, color, sizePx);
    entry.texture.needsUpdate = true;
    entry.sprite.position.copy(o.position);
    entry.sprite.scale.set(2.2 * (o.size || 1), 0.83 * (o.size || 1), 1);
    entry.y0 = o.position.y;
    entry.maxLife = o.life || 0.9;
    entry.life = entry.maxLife;
    entry.active = true;
    entry.sprite.visible = true;
  }

  _spawnHtml(o) {
    let entry = this._html.find((h) => !h.active);
    if (!entry) {
      entry = this._html.reduce((a, b) => (a.life / a.maxLife) < (b.life / b.maxLife) ? a : b);
    }
    entry.el.textContent = o.text;
    entry.el.style.color = o.color || '#7df9ff';
    entry.el.style.fontSize = `${Math.round(14 * (o.size || 1))}px`;
    entry.el.style.display = 'block';
    entry.maxLife = o.life || 1.2;
    entry.life = entry.maxLife;
    entry.active = true;
    entry._pos = o.position.clone();
  }

  update(dt, camera) {
    this._time += dt;
    for (const s of this._sprites) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        s.sprite.visible = false;
        continue;
      }
      const t = 1 - s.life / s.maxLife;
      s.sprite.position.y = s.y0 + t * 1.6;
      s.sprite.material.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    }
    if (!this.htmlContainer) return;
    for (const h of this._html) {
      if (!h.active) continue;
      h.life -= dt;
      if (h.life <= 0) {
        h.active = false;
        h.el.style.display = 'none';
        continue;
      }
      const t = 1 - h.life / h.maxLife;
      this._v3.copy(h._pos);
      this._v3.y += t * 1.2;
      this._v3.project(camera);
      const cw = this.htmlContainer.clientWidth || window.innerWidth;
      const ch = this.htmlContainer.clientHeight || window.innerHeight;
      const x = (this._v3.x * 0.5 + 0.5) * cw;
      const y = (-this._v3.y * 0.5 + 0.5) * ch;
      h.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      h.el.style.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    }
  }

  clear() {
    for (const s of this._sprites) {
      s.active = false;
      s.sprite.visible = false;
    }
    for (const h of this._html) {
      h.active = false;
      h.el.style.display = 'none';
    }
  }

  dispose() {
    for (const s of this._sprites) {
      this.scene.remove(s.sprite);
      s.sprite.material.dispose();
      s.texture.dispose();
    }
    for (const h of this._html) {
      h.el.remove();
    }
    this._sprites.length = 0;
    this._html.length = 0;
  }
}

export { FloatingTextPool };
export default FloatingTextPool;
