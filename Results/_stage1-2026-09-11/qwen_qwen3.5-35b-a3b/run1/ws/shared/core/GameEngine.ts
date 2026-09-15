import { InputManager } from './InputManager.js';
import { ParticleManager } from './ParticleManager.js';
import { CameraShake } from '../vfx/CameraShake.js';
import { HitStop } from '../vfx/HitStop.js';

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'VICTORY';

export class GameEngine {
  private lastTime: number = 0;
  private accumulator: number = 0;
  private fixedStep: number = 1 / 60;
  
  public timescale: number = 1.0;
  public gameState: GameState = 'MENU';
  
  private inputManager: InputManager;
  private particleManager: ParticleManager;
  private cameraShake: CameraShake;
  private hitStop: HitStop;
  
  private animationId: number | null = null;
  private onGameUpdate: ((deltaTime: number) => void) | null = null;
  private onGameRender: (() => void) | null = null;

  constructor(
    inputManager: InputManager,
    particleManager: ParticleManager,
    cameraShake: CameraShake,
    hitStop: HitStop
  ) {
    this.inputManager = inputManager;
    this.particleManager = particleManager;
    this.cameraShake = cameraShake;
    this.hitStop = hitStop;
    
    this.lastTime = performance.now();
  }

  public setGameUpdateCallback(callback: (deltaTime: number) => void): void {
    this.onGameUpdate = callback;
  }

  public setGameRenderCallback(callback: () => void): void {
    this.onGameRender = callback;
  }

  public start(): void {
    if (this.animationId !== null) return;
    
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public pause(): void {
    this.gameState = 'PAUSED';
    this.timescale = 0;
  }

  public resume(): void {
    if (this.gameState === 'PAUSED') {
      this.gameState = 'PLAYING';
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  private loop(currentTime: number): void {
    if (this.gameState !== 'PLAYING' && this.timescale === 0) {
      // Still render even when paused for UI updates
      if (this.onGameRender) {
        this.onGameRender();
      }
      this.animationId = requestAnimationFrame(this.loop.bind(this));
      return;
    }

    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
    this.lastTime = currentTime;
    
    const effectiveDelta = deltaTime * this.timescale;
    
    // Update input
    this.inputManager.update();
    
    // Update VFX systems
    this.cameraShake.update(effectiveDelta);
    this.hitStop.update(effectiveDelta);
    this.particleManager.update(effectiveDelta);
    
    // Game logic update
    if (this.onGameUpdate) {
      try {
        this.onGameUpdate(effectiveDelta);
      } catch (error) {
        console.error('Game update error:', error);
        this.timescale = 1.0; // Reset hit-stop on error
      }
    }
    
    // Render
    if (this.onGameRender) {
      this.onGameRender();
    }
    
    this.animationId = requestAnimationFrame(this.loop.bind(this));
  }

  public triggerCameraShake(intensity: number, duration: number): void {
    this.cameraShake.shake(intensity, duration);
  }

  public triggerHitStop(duration: number): void {
    this.hitStop.apply(duration);
  }

  public setGameState(state: GameState): void {
    this.gameState = state;
    
    if (state === 'PLAYING') {
      this.timescale = 1.0;
      this.lastTime = performance.now();
    } else if (state === 'PAUSED' || state === 'GAME_OVER' || state === 'VICTORY') {
      this.timescale = 0;
    }
  }

  public getDeltaTime(): number {
    return this.lastTime / 1000;
  }

  public getInputManager(): InputManager {
    return this.inputManager;
  }

  public getParticleManager(): ParticleManager {
    return this.particleManager;
  }

  public getCameraShake(): CameraShake {
    return this.cameraShake;
  }

  public getHitStop(): HitStop {
    return this.hitStop;
  }
}
