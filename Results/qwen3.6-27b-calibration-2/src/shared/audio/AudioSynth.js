/**
 * AudioSynth — Web Audio API synthesizer for SFX and procedural music.
 * Lazy-init on first user gesture. All sounds generated via oscillators + noise.
 */

let audioCtx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let initialized = false;
let musicPlaying = false;
let musicNodes = [];

function init() {
  if (initialized) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(audioCtx.destination);

  musicGain = audioCtx.createGain();
  musicGain.gain.value = 0.3;
  musicGain.connect(masterGain);

  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = 0.6;
  sfxGain.connect(masterGain);

  initialized = true;
}

function ensureInitialized() {
  if (!initialized) {
    init();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// --- SFX ---

export function playHit(pitch = 880, duration = 0.05) {
  ensureInitialized();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, audioCtx.currentTime + duration);
  gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration + 0.01);
}

export function playScore(ascending = true) {
  ensureInitialized();
  if (!audioCtx) return;
  const notes = ascending ? [523.25, 659.25, 783.99, 1046.50] : [1046.50, 783.99, 659.25, 523.25];
  const baseTime = audioCtx.currentTime;
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, baseTime + i * 0.1);
    gain.gain.setValueAtTime(0, baseTime + i * 0.1);
    gain.gain.linearRampToValueAtTime(0.2, baseTime + i * 0.1 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, baseTime + i * 0.1 + 0.15);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(baseTime + i * 0.1);
    osc.stop(baseTime + i * 0.1 + 0.16);
  });
}

export function playExplosion(duration = 0.3) {
  ensureInitialized();
  if (!audioCtx) return;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  source.start(audioCtx.currentTime);
}

export function playBounce(pitch = 440) {
  ensureInitialized();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.7, audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.09);
}

// --- Procedural Music ---

export function startMusic() {
  ensureInitialized();
  if (!audioCtx || musicPlaying) return;
  musicPlaying = true;
  musicNodes = [];

  // Bass drone
  const bassOsc = audioCtx.createOscillator();
  const bassGain = audioCtx.createGain();
  bassOsc.type = 'sawtooth';
  bassOsc.frequency.setValueAtTime(55, audioCtx.currentTime);
  bassGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  const bassFilter = audioCtx.createBiquadFilter();
  bassFilter.type = 'lowpass';
  bassFilter.frequency.setValueAtTime(200, audioCtx.currentTime);
  bassOsc.connect(bassFilter);
  bassFilter.connect(bassGain);
  bassGain.connect(musicGain);
  bassOsc.start();
  musicNodes.push(bassOsc);

  // Sub bass
  const subOsc = audioCtx.createOscillator();
  const subGain = audioCtx.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(55, audioCtx.currentTime);
  subGain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  subOsc.connect(subGain);
  subGain.connect(musicGain);
  subOsc.start();
  musicNodes.push(subOsc);

  // Hi-hat noise bursts
  function scheduleHiHat() {
    if (!musicPlaying) return;
    const bufferSize = audioCtx.sampleRate * 0.05;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(musicGain);
    source.start(audioCtx.currentTime);
    setTimeout(scheduleHiHat, 250);
  }
  scheduleHiHat();

  // Arpeggiated synth line
  const arpNotes = [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63];
  let arpIndex = 0;
  function scheduleArp() {
    if (!musicPlaying) return;
    const freq = arpNotes[arpIndex % arpNotes.length];
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.21);
    arpIndex++;
    setTimeout(scheduleArp, 300);
  }
  scheduleArp();
}

export function stopMusic() {
  musicPlaying = false;
  musicNodes.forEach(node => {
    try { node.stop(); } catch (e) { /* already stopped */ }
  });
  musicNodes = [];
}

export function setMasterVolume(v) {
  if (masterGain) {
    masterGain.gain.value = Math.max(0, Math.min(1, v));
  }
}

export function getAudioContext() {
  return audioCtx;
}
