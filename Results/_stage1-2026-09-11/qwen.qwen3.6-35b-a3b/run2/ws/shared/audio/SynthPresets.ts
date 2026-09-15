import type { AudioConfig } from '../types.js';

export const SYNTH_PRESETS: Record<string, AudioConfig> = {
  LASER: { frequency: 880, type: 'square' as OscillatorType, gain: 0.15, duration: 0.1, decayRate: 0.5 },
  EXPLOSION: { frequency: 100, type: 'sawtooth' as OscillatorType, gain: 0.3, duration: 0.4, decayRate: 0.8 },
  UFO_LASER: { frequency: 220, type: 'triangle' as OscillatorType, gain: 0.1, duration: 0.2, decayRate: 0.6 },
  POWERUP: { frequency: 440, type: 'sine' as OscillatorType, gain: 0.2, duration: 0.3, decayRate: 0.3 },
  PLAYER_HIT: { frequency: 80, type: 'square' as OscillatorType, gain: 0.25, duration: 0.5, decayRate: 0.9 },
  INVADER_MARCH: { frequency: 60, type: 'sine' as OscillatorType, gain: 0.05, duration: 0.05, decayRate: 1.0 },
  UFO_APPEAR: { frequency: 330, type: 'sawtooth' as OscillatorType, gain: 0.2, duration: 0.8, decayRate: 0.4 },
};
