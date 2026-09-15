import type { AudioConfig } from '../types.js';
import { SYNTH_PRESETS } from './SynthPresets.js';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = false;

  constructor() {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
      this.enabled = true;
    } catch {
      console.warn('Web Audio API not available');
    }
  }

  play(name: string, override?: Partial<AudioConfig>): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const preset = SYNTH_PRESETS[name];
    if (!preset) return;
    const config: AudioConfig = { ...preset, ...override };

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = config.type;
    osc.frequency.setValueAtTime(config.frequency, this.ctx.currentTime);
    gain.gain.setValueAtTime(config.gain, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + config.duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + config.duration);
  }

  playLaser(): void { this.play('LASER'); }
  playExplosion(): void { this.play('EXPLOSION'); }
  playUfoLaser(): void { this.play('UFO_LASER'); }
  playPowerup(): void { this.play('POWERUP'); }
  playPlayerHit(): void { this.play('PLAYER_HIT'); }
  playMarch(): void { this.play('INVADER_MARCH'); }
  playUfoAppear(): void { this.play('UFO_APPEAR'); }

  dispose(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.enabled = false;
  }
}
