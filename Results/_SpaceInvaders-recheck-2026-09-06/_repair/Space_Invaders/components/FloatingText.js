import * as THREE from 'three';   // [REPAIR 2026-09-06 - not model output]
import { FloatingText } from '../../shared/vfx/FloatingText.js';

/**
 * Game-specific floating text factory for Space Invaders.
 * Wraps the shared FloatingText with game-appropriate styling and scoring values.
 */
export class GameFloatingText {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.activeTexts = [];
  }

  /**
   * Spawn a floating score text at world position.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {string} text - e.g. "100", "BONUS!", "MISSILE"
   * @param {string} color - hex color string
   */
  spawn(x, y, z, text, color = '#00ffcc') {
    const ft = new FloatingText(this.scene);
    ft.setPosition(x, y + 1.5, z);
    ft.setText(text, color);
    this.activeTexts.push(ft);
    return ft;
  }

  /**
   * Update all active floating texts each frame.
   */
  update() {
    for (let i = this.activeTexts.length - 1; i >= 0; i--) {
      const ft = this.activeTexts[i];
      if (!ft.update()) {
        ft.dispose();
        this.activeTexts.splice(i, 1);
      }
    }
  }

  /**
   * Dispose all floating texts and clear the list.
   */
  dispose() {
    for (const ft of this.activeTexts) {
      ft.dispose();
    }
    this.activeTexts.length = 0;
  }
}
