/**
 * Scoring system — tracks score, combo multiplier, high score persistence.
 */

import { Vector3 } from 'three';
import type { Synth } from '@shared/audio/Synth';
import type { FloatingText } from '@shared/vfx/FloatingText';
import { ALIEN_POINT_VALUES } from '@shared/utils/Constants';

export class ScoringSystem {
  private score: number = 0;
  private highScore: number = parseInt(localStorage.getItem('spaceInvaders_highScore') || '0', 10);
  private combo: number = 0;
  private consecutiveKills: number = 0;
  private lastHitTime: number = 0;
  private synth: Synth | null = null;
  private floatingText: FloatingText | null = null;

  constructor(synth?: Synth, floatingText?: FloatingText) {
    this.synth = synth ?? null;
    this.floatingText = floatingText ?? null;
  }

  /** Add points for destroying an alien */
  addAlienPoints(row: number, col: number, position: Vector3): void {
    const now = performance.now();
    
    // Combo system — consecutive kills within 2 seconds
    if (now - this.lastHitTime < 2000) {
      this.combo++;
    } else {
      this.combo = 1;
    }
    this.lastHitTime = now;

    const basePoints = ALIEN_POINT_VALUES[row] || 4;
    const multiplier = Math.min(this.combo, 10); // cap at x10
    const points = basePoints * multiplier;
    
    this.score += points;
    this.consecutiveKills++;

    // Play alien hit SFX with pitch variation based on type
    if (this.synth) {
      this.synth.playAlienHit(row);
    }

    // Show floating score text
    if (this.floatingText) {
      const colorMap: Record<number, string> = {
        0: '#ff00ff',
        1: '#00ffff',
        2: '#00ffff',
        3: '#00ff88',
        4: '#00ff88',
      };
      const color = colorMap[row] || '#ffffff';
      let text = `+${points}`;
      if (multiplier > 1) {
        text += ` x${multiplier}`;
      }
      this.floatingText.show(position, text, color);
    }

    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('spaceInvaders_highScore', String(this.highScore));
    }
  }

  /** Add points for destroying UFO */
  addUFOPoints(points: number, position: Vector3): void {
    this.score += points;
    this.consecutiveKills++;

    if (this.synth) {
      this.synth.playAlienHit(0); // high-pitched beep
    }

    if (this.floatingText) {
      let text = `+${points} UFO`;
      const color = '#ff4444';
      this.floatingText.show(position, text, color);
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('spaceInvaders_highScore', String(this.highScore));
    }
  }

  /** Reset combo on player hit */
  resetCombo(): void {
    this.combo = 0;
    this.consecutiveKills = 0;
  }

  /** Get current score */
  getScore(): number {
    return this.score;
  }

  /** Get high score */
  getHighScore(): number {
    return this.highScore;
  }

  /** Get combo multiplier */
  getComboMultiplier(): number {
    return Math.min(this.combo, 10);
  }

  /** Reset scoring system for new game */
  reset(): void {
    this.score = 0;
    this.combo = 0;
    this.consecutiveKills = 0;
    this.lastHitTime = 0;
  }
}
