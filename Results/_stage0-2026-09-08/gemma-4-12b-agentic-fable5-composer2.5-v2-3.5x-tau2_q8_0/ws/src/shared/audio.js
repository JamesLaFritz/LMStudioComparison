import { AudioContext } from 'three/examples/jsm/audio/AudioListener';

let ctx = null;
let playing = false;

export async function initAudio() {
  if (ctx && ctx.state !== 'suspended') return;
  try {
    ctx = new AudioContext();
    await ctx.resume();
    playing = true;
  } catch (e) {
    console.warn('Web Audio resume blocked — user gesture needed', e);
  }
}

function createOscillator(freq, type, duration, volume) {
  if (!ctx || !playing) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration - 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export const playLaser = () => createOscillator(440, 'square', 0.12, 0.3);
export const playExplosion = () => createOscillator(80, 'sawtooth', 0.45, 0.6);
export const playWin = () => {
  createOscillator(261.63, 'sine', 0.6, 0.4); // C4
  setTimeout(() => createOscillator(392.00, 'sine', 0.6, 0.4), 150); // G4
};
export const playGameOver = () => {
  createOscillator(110, 'sawtooth', 0.8, 0.5);
  setTimeout(() => createOscillator(93.21, 'sawtooth', 0.6, 0.4), 200); // A2
};