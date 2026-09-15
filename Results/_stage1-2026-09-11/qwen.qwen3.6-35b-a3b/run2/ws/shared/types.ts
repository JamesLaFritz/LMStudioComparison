import * as THREE from 'three';

export interface Vector3f {
  x: number;
  y: number;
  z: number;
}

export interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface HitResult {
  hit: boolean;
  entityA?: THREE.Object3D | null;
  entityB?: THREE.Object3D | null;
  normal?: THREE.Vector3;
  depth?: number;
}

export interface GameEvent {
  type: 'EXPLOSION' | 'PLAYER_HIT' | 'UFO_DESTROYED' | 'POWERUP_COLLECT' | 'LEVEL_COMPLETE';
  position?: Vector3f;
  intensity?: number;
  score?: number;
}

export interface PoolItem<T> {
  object: T;
  active: boolean;
}

export interface AudioConfig {
  frequency: number;
  type: OscillatorType;
  gain: number;
  duration: number;
  decayRate?: number;
}

export enum InvaderType {
  TYPE_0 = 0, // Top row - highest value
  TYPE_1 = 1, // Middle rows
  TYPE_2 = 2, // Bottom rows
}

export const INVADER_SCORES: Record<InvaderType, number> = {
  [InvaderType.TYPE_0]: 30,
  [InvaderType.TYPE_1]: 20,
  [InvaderType.TYPE_2],
};

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  LEVEL_TRANSITION = 'LEVEL_TRANSITION',
}
