import * as THREE from 'three';
import type { AudioEngine } from '../../../shared/audio/AudioEngine.js';
import { CameraShake } from '../../../shared/vfx/CameraShake.js';
import { ParticleManager } from '../../../shared/vfx/ParticleManager.js';
import { ShockwaveRing } from '../../../shared/vfx/ShockwaveRing.js';
import { FloatingScoreText } from '../../../shared/vfx/FloatingScoreText.js';
import type { Vector3f } from '../../../shared/types.js';

export interface LevelConfig {
  level: number;
  invaderSpeed: number;
  enemyFireRate: number;
  ufoInterval: number;
}

export class LevelManager {
  private audio: AudioEngine;
  private cameraShake: CameraShake;
  private particleManager: ParticleManager;
  private shockwaveRing: ShockwaveRing;
  private floatingScoreText: FloatingScoreText;
  private scene: THREE.Scene;

  private currentLevel: number = 1;
  private score: number = 0;
  private highScore: number = 0;
  private lives: number = 3;
  private playerAlive: boolean = true;
  private gameOver: boolean = false;
  private levelTransition: boolean = false;

  constructor(
    scene: THREE.Scene,
    audio: AudioEngine,
    cameraShake: CameraShake,
    particleManager: ParticleManager,
    shockwaveRing: ShockwaveRing,
    floatingScoreText: FloatingScoreText
  ) {
    this.scene = scene;
    this.audio = audio;
    this.cameraShake = cameraShake;
    this.particleManager = particleManager;
    this.shockwaveRing = shockwaveRing;
    this.floatingScoreText = floatingScoreText;
  }

  get level(): number { return this.currentLevel; }
  get score(): number { return this.score; }
  get highScore(): number { return this.highScore; }
  get lives(): number { return this.lives; }
  get playerAlive(): boolean { return this.playerAlive; }
  get gameOver(): boolean { return this.gameOver; }
  get levelTransition(): boolean { return this.levelTransition; }

  getLevelConfig(): LevelConfig {
    const speedMult = 1.0 + (this.currentLevel - 1) * 0.15;
    const fireRateMult = Math.max(0.3, 1.0 - (this.currentLevel - 1) * 0.1);
    return {
      level: this.currentLevel,
      invaderSpeed: 0.3 * speedMult,
      enemyFireRate: fireRateMult,
      ufoInterval: Math.max(10, 25 - this.currentLevel * 2),
    };
  }

  addScore(points: number, position?: Vector3f): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    if (position) {
      this.floatingScoreText.spawn(position, points);
    }
  }

  spawnExplosionParticles(position: Vector3f, color: number = 0x00ffff): void {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 3.0;
      this.particleManager.spawn({
        position: { x: position.x, y: position.y, z: 0 },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, z: 0 },
        color: color,
        size: 0.1 + Math.random() * 0.15,
        life: 0.3 + Math.random() * 0.4,
      });
    }
  }

  triggerCameraShake(intensity: number): void {
    this.cameraShake.trigger(intensity);
  }

  spawnShockwave(position: Vector3f, color: number = 0x00ffff): void {
    this.shockwaveRing.spawn(position, color);
  }

  playerHit(): void {
    this.lives--;
    this.playerAlive = false;
    this.audio.playPlayerHit();
    this.triggerCameraShake(0.3);
    if (this.lives <= 0) {
      this.gameOver = true;
    }
  }

  playerResurrect(position: THREE.Vector3): void {
    this.playerAlive = true;
    // Player position will be set by the game loop
  }

  levelComplete(): void {
    this.levelTransition = true;
    this.currentLevel++;
    setTimeout(() => {
      this.levelTransition = false;
    }, 2000);
  }

  resetGame(): void {
    this.currentLevel = 1;
    this.score = 0;
    this.lives = 3;
    this.playerAlive = true;
    this.gameOver = false;
  }

  dispose(): void {
    // No specific resources to clean up
  }
}