import { AudioSynth } from '../../shared/audio/AudioSynth.js';

export function setupAudio(bus) {
  const synth = new AudioSynth();

  bus.on('playerFire', () => {
    synth.playTone(880, 'square', 0.08, 0.15);
  });

  bus.on('alienFire', () => {
    synth.playTone(220, 'sawtooth', 0.15, 0.1);
  });

  bus.on('alienDeath', () => {
    synth.playNoise(0.1, 0.2);
    synth.playSweep(440, 110, 0.15);
  });

  bus.on('playerHit', () => {
    synth.playNoise(0.2, 0.25);
  });

  bus.on('ufoAppear', () => {
    synth.playSweep(220, 880, 0.5, 0.15);
  });

  bus.on('ufoDeath', () => {
    synth.playNoise(0.3, 0.3);
    synth.playSweep(880, 55, 0.4, 0.2);
  });

  bus.on('shieldHit', () => {
    synth.playNoise(0.05, 0.1);
  });

  bus.on('powerUpCollect', () => {
    const notes = [261, 329, 392, 523];
    notes.forEach((freq, i) => {
      setTimeout(() => synth.playTone(freq, 'sine', 0.1, 0.15), i * 60);
    });
  });

  bus.on('waveStart', () => {
    synth.playTone(440, 'sine', 0.5, 0.2);
    synth.playTone(554, 'sine', 0.5, 0.15);
  });

  bus.on('gameOver', () => {
    const notes = [440, 415, 392, 370, 349];
    notes.forEach((freq, i) => {
      setTimeout(() => synth.playTone(freq, 'sawtooth', 0.4, 0.15), i * 200);
    });
  });

  bus.on('bossHit', () => {
    synth.playNoise(0.08, 0.2);
  });

  bus.on('bossDeath', () => {
    synth.playNoise(0.4, 0.35);
    synth.playSweep(880, 55, 0.6, 0.25);
  });

  return synth;
}
