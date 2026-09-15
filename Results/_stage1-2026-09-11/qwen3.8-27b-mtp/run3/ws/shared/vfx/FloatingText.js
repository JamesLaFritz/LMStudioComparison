// shared/vfx/FloatingText.js
// Pooled floating score text: canvas-texture sprites that rise and fade at the
// kill point. Textures are cached per (text, color) pair in a small LRU; evicted
// textures are disposed explicitly.

import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';
import { TextureFactory } from '../procedural/TextureFactory.js';

const MAX_SPRITES = 16;
const TEXTURE_CACHE_MAX = 32;
const RISE_SPEED = 2.4;      // world units / s
const FADE_TIME = 0.9;       // seconds to full fade
const LIFETIME = 1.15;

export class FloatingText {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.pool = new ObjectPool(MAX_SPRITES, () => ({ active: false, age: 0 }));

    // Preallocate sprites (THREE.Sprite owns its own static geometry; each sprite gets a
    // dedicated material so opacity can animate independently).
    this.sprites = [];
    for (let i = 0; i < MAX_SPRITES; i++) {
      const slot = this.pool.items[i];
      const mat = new THREE.SpriteMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.frustumCulled = false;
      scene.add(sprite);
      slot.sprite = sprite;
      this.sprites.push(sprite);
    }

    // Texture LRU cache: key → { texture, refs }.
    this._cache = new Map();
  }

  /**
   * Spawn a floating text at world position.
   * @param {string} text e.g. "+30×2"
   * @param {{x:number,y:number,z?:number}} pos
   * @param {number|string|THREE.Color} colorHex
   */
  spawn(text, pos, colorHex = 0xffffff) {
    const slot = this.pool.acquire();
    if (!slot) return null;

    const key = text + '|' + (colorHex instanceof THREE.Color ? '#' + colorHex.getHexString() : colorHex);
    let entry = this._cache.get(key);
    if (!entry) {
      const texture = TextureFactory.textSprite(text, colorHex);
      entry = { texture, refs: 0 };
      this._cache.set(key, entry);
      // Evict oldest entries beyond the cap.
      while (this._cache.size > TEXTURE_CACHE_MAX) {
        const firstKey = this._cache.keys().next().value;
        const old = this._cache.get(firstKey);
        if (old.refs === 0) {
          old.texture.dispose();
          this._cache.delete(firstKey);
        } else {
          break; // can't evict a live texture; stop here
        }
      }
    }

    entry.refs++;
    slot.age = 0;
    const sprite = slot.sprite;
    sprite.material.map = entry.texture;
    sprite.material.needsUpdate = true;
    sprite.position.set(pos.x, pos.y, (pos.z || 0) + 0.1); // slight z-offset to avoid z-fighting with emitters

    // Scale proportional to text length so long strings don't clip.
    const aspect = entry.texture.image.width / entry.texture.image.height;
    const h = 0.9;
    sprite.scale.set(h * aspect, h, 1);

    sprite.material.opacity = 0;
    sprite.visible = true;
    return slot;
  }

  /**
   * @param {number} dt scaled seconds
   */
  update(dt) {
    for (const slot of this.pool.items) {
      if (!slot.active) continue;
      slot.age += dt;
      const t = slot.age / LIFETIME;
      if (t >= 1) {
        this._release(slot);
        continue;
      }

      const sprite = slot.sprite;
      // Rise + ease-out fade.
      sprite.position.y += RISE_SPEED * dt;
      const fadeIn = Math.min(1, t / 0.12);           // quick pop-in
      const fadeOut = 1 - Math.pow(t, 2.2);            // slow tail
      sprite.material.opacity = fadeIn * fadeOut;

      // Subtle scale pulse on spawn.
      const s = 1 + 0.15 * (1 - Math.min(1, t / 0.15));
      const baseH = 0.9;
      const aspect = sprite.material.map ? sprite.material.map.image.width / sprite.material.map.image.height : 2.67;
      sprite.scale.set(baseH * s * aspect, baseH * s, 1);
    }
  }

  _release(slot) {
    slot.sprite.visible = false;
    const mat = slot.sprite.material;
    if (mat.map && this._cache.has(mat.map)) {
      // Decrement ref count via cache lookup by texture identity.
      for (const entry of this._cache.values()) {
        if (entry.texture === mat.map) {
          entry.refs--;
          break;
        }
      }
    }
    mat.opacity = 0;
    this.pool.release(slot);
  }

  clearAll() {
    for (const slot of this.pool.items) {
      if (slot.active) this._release(slot);
    }
  }

  dispose() {
    for (const sprite of this.sprites) {
      sprite.material.dispose();
      this.scene.remove(sprite);
    }
    this.sprites.length = 0;
    for (const entry of this._cache.values()) entry.texture.dispose();
    this._cache.clear();
    // Shared geometry is owned by the first sprite's material? No — PlaneGeometry was created once here.
    // Dispose it explicitly:
    // (kept as a local in constructor scope; re-create reference via any sprite)
  }
}
