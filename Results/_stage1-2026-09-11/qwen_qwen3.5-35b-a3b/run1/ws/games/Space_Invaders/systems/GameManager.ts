import { GameEngine } from '../../../shared/core/GameEngine.js';
import { InputManager } from '../../../shared/core/InputManager.js';
import { ParticleManager } from '../../../shared/core/ParticleManager.js';
import { CameraShake } from '../../../shared/vfx/CameraShake.js';
import { HitStop } from '../../../shared/vfx/HitStop.js';
import { FloatingText } from '../../../shared/vfx/FloatingText.js';
import { AudioSynth } from '../../../shared/utils/AudioSynth.js';
import { MathUtils } from '../../../shared/utils/MathUtils.js';

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

interface ScoreEntry {
  score: number;
  date: string;
}

export class GameManager {
  private engine: GameEngine;
  private input: InputManager;
  private particleManager: ParticleManager;
  private cameraShake: CameraShake;
  private hitStop: HitStop;
  private floatingText: FloatingText;
  private audioSynth: AudioSynth;

  state: GameState = GameState.MENU;
  score: number = 0;
  highScore: number = parseInt(localStorage.getItem('spaceInvadersHighScore') || '0');
  lives: number = 3;
  wave: number = 1;
  totalKills: number = 0;
  multiplier: number = 1;
  consecutiveKills: number = 0;

  private scoreMultiplierTimer: number = 0;
  private scoreMultiplierMaxTime: number = 5.0; // seconds to maintain multiplier

  constructor(
    engine: GameEngine,
    input: InputManager,
    particleManager: ParticleManager,
    cameraShake: CameraShake,
    hitStop: HitStop,
    floatingText: FloatingText,
    audioSynth: AudioSynth
  ) {
    this.engine = engine;
    this.input = input;
    this.particleManager = particleManager;
    this.cameraShake = cameraShake;
    this.hitStop = hitStop;
    this.floatingText = floatingText;
    this.audioSynth = audioSynth;

    // Load high score from storage if available
    const savedHighScore = localStorage.getItem('spaceInvadersHighScore');
    if (savedHighScore) {
      this.highScore = parseInt(savedHighScore);
    }
  }

  update(deltaTime: number): void {
    switch (this.state) {
      case GameState.MENU:
        this.updateMenu(deltaTime);
        break;
      case GameState.PLAYING:
        this.updatePlaying(deltaTime);
        break;
      case GameState.PAUSED:
        // Pause logic handled by engine, just update UI if needed
        break;
      case GameState.GAME_OVER:
        this.updateGameOver(deltaTime);
        break;
      case GameState.VICTORY:
        this.updateVictory(deltaTime);
        break;
    }

    // Update score multiplier timer
    if (this.multiplier > 1) {
      this.scoreMultiplierTimer -= deltaTime;
      if (this.scoreMultiplierTimer <= 0) {
        this.multiplier = 1;
        this.consecutiveKills = 0;
      }
    }
  }

  private updateMenu(deltaTime: number): void {
    // Menu logic - waiting for player input to start game
    if (this.input.isActionTriggered('start')) {
      this.startGame();
    }

    // Display high score in menu
    if (this.engine.renderer) {
      this.floatingText.updateUI(this.highScore, 0);
    }
  }

  private updatePlaying(deltaTime: number): void {
    // Update floating text UI with current score and lives
    if (this.engine.renderer) {
      this.floatingText.updateUI(this.score, this.lives);
    }
  }

  private updateGameOver(deltaTime: number): void {
    // Game over screen - waiting for retry
    if (this.input.isActionTriggered('start')) {
      this.startGame();
    }

    // Display final score and high score comparison
    if (this.engine.renderer) {
      const isNewHigh = this.score >= this.highScore;
      this.floatingText.updateUI(this.score, this.lives, isNewHigh);
    }
  }

  private updateVictory(deltaTime: number): void {
    // Victory screen - waiting for next wave or menu
    if (this.input.isActionTriggered('start')) {
      this.startNextWave();
    } else if (this.input.isActionTriggered('menu')) {
      this.state = GameState.MENU;
    }

    if (this.engine.renderer) {
      this.floatingText.updateUI(this.score, 0, true); // Show victory indicator
    }
  }

  startGame(): void {
    this.resetGameState();
    this.state = GameState.PLAYING;
    this.audioSynth.playSound('start');
    
    // Show floating text for "PRESS START" or similar
    if (this.engine.renderer) {
      this.floatingText.showFloatingText('PRESS START', new THREE.Vector3(0, 2, 0), 0x00ff00);
    }
  }

  resetGameState(): void {
    this.score = 0;
    this.lives = config.initialLives;
    this.wave = 1;
    this.totalKills = 0;
    this.multiplier = 1;
    this.consecutiveKills = 0;
    this.scoreMultiplierTimer = 0;
  }

  startNextWave(): void {
    if (this.state === GameState.VICTORY) {
      // Continue to next wave after victory
      this.wave++;
      this.resetGameState();
      this.state = GameState.PLAYING;
      
      if (this.engine.renderer) {
        this.floatingText.showFloatingText(`WAVE ${this.wave}`, new THREE.Vector3(0, 2, 0), 0x00ffff);
      }
    } else {
      // Start fresh game after victory screen
      this.startGame();
    }
  }

  addScore(points: number, position: THREE.Vector3): void {
    this.score += points * this.multiplier;
    this.totalKills++;
    
    // Update multiplier logic
    this.consecutiveKills++;
    if (this.consecutiveKills >= config.multiplierThreshold) {
      this.multiplier = Math.min(this.multiplier + 1, config.maxMultiplier);
      this.scoreMultiplierTimer = this.scoreMultiplierMaxTime;
    }

    // Update high score if needed
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('spaceInvadersHighScore', this.highScore.toString());
    }

    // Play score sound and show floating text
    this.audioSynth.playSound('score');
    
    if (this.engine.renderer) {
      const color = this.multiplier > 1 ? 0xffaa00 : 0x00ff00;
      const text = `${points * this.multiplier} pts`;
      this.floatingText.showFloatingText(text, position, color);
    }

    // Trigger hit-stop for impact feel
    this.hitStop.activate(100); // 100ms hit-stop
    
    // Camera shake based on points awarded (more points = more shake)
    const shakeIntensity = Math.min(points * 0.02, 0.5);
    this.cameraShake.shake(shakeIntensity, 0.3);
  }

  loseLife(): void {
    this.lives--;
    this.multiplier = 1;
    this.consecutiveKills = 0;
    
    // Play death sound
    this.audioSynth.playSound('death');
    
    // Camera shake on death
    this.cameraShake.shake(0.8, 0.5);
    
    if (this.lives <= 0) {
      this.state = GameState.GAME_OVER;
      
      // Show game over text
      if (this.engine.renderer) {
        this.floatingText.showFloatingText('GAME OVER', new THREE.Vector3(0, 2, 0), 0xff0000);
        
        setTimeout(() => {
          if (this.engine.renderer) {
            this.floatingText.showFloatingText('PRESS START TO RESTART', new THREE.Vector3(0, 1.5, 0), 0xaaaaaa);
          }
        }, 2000);
      }
    } else {
      // Show "LIVES LEFT" text
      if (this.engine.renderer) {
        this.floatingText.showFloatingText(
          `LIVES: ${this.lives}`, 
          new THREE.Vector3(0, -1.5, 0), 
          0xffaa00
        );
      }
    }
  }

  triggerHitStop(duration: number): void {
    this.hitStop.activate(duration);
  }

  getWaveDifficultyMultiplier(): number {
    return 1.0 + (this.wave - 1) * config.difficultyPerWave;
  }

  dispose(): void {
    // Cleanup any resources if needed
  }
}

// Import config - parent directory since this file is in systems/
import { CONFIG as config } from '../config.js';