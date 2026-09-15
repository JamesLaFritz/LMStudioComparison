/**
 * AudioSynth - Web Audio API synthesized sound effects and music.
 * Zero external audio files — all sounds generated procedurally.
 */

const AUDIO_BUFFER_SIZE = 44100; // Standard sample rate
const AUDIO_SAMPLE_RATE = 44100;
let audioCtx = null;

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// --- Sound Effect Synthesis ---

function playTone(freq, type, duration, volume = 0.3, detune = 0) {
  ensureAudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (detune !== 0) {
    osc.detune.value = detune;
  }
  
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playNoise(duration = 0.1, volume = 0.2) {
  ensureAudioContext();
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  
  // Add a filter for character
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 800;
  
  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  
  noiseSource.start();
}

function playAlienShoot() {
  ensureAudioContext();
  // Short noise burst with pitch sweep
  const bufferSize = audioCtx.sampleRate * 0.1;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2000;
  filter.Q.value = 0.5;
  filter.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
  
  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  
  noiseSource.start();
}

function playPlayerShoot() {
  ensureAudioContext();
  // Crisp click with reverb tail
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.15);
  
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

function playAlienDeath() {
  ensureAudioContext();
  // Frequency sweep down with noise burst
  const bufferSize = audioCtx.sampleRate * 0.2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
  
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(4000, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.25);
  
  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  
  noiseSource.start();
  noiseSource.stop(audioCtx.currentTime + 0.25);
}

function playPlayerHit() {
  ensureAudioContext();
  // Low thud with rumble
  const bufferSize = audioCtx.sampleRate * 0.3;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, audioCtx.currentTime);
  
  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  
  noiseSource.start();
  noiseSource.stop(audioCtx.currentTime + 0.3);
}

function playWaveStart() {
  ensureAudioContext();
  // Arpeggiated ascending tones
  const notes = [523.25, 659.25, 783.99, 1046.5];
  
  for (let i = 0; i < notes.length; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.value = notes[i];
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.1 + 0.4);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(audioCtx.currentTime + i * 0.1);
    osc.stop(audioCtx.currentTime + i * 0.1 + 0.5);
  }
}

function playGameOver() {
  ensureAudioContext();
  // Descending tones with noise
  const notes = [440, 392, 349.23, 293.66];
  
  for (let i = 0; i < notes.length; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.value = notes[i];
    
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime + i * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.3 + 0.6);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(audioCtx.currentTime + i * 0.3);
    osc.stop(audioCtx.currentTime + i * 0.3 + 0.8);
  }
}

// --- Background Music Loop ---

let bgmOscillators = [];
let bgmGain = null;
let bgmEnabled = false;

function startBackgroundMusic() {
  ensureAudioContext();
  
  // Arpeggiated pattern: repeating sequence of notes
  const pattern = [
    { note: 261.63, time: 0 },   // C4
    { note: 329.63, time: 0.25 }, // E4
    { note: 392, time: 0.5 },     // G4
    { note: 440, time: 0.75 },    // A4
    { note: 523.25, time: 1 },    // C5
    { note: 659.25, time: 1.25 }, // E5
    { note: 783.99, time: 1.5 },  // G5
    { note: 440, time: 1.75 },    // A5
  ];
  
  const loopDuration = 2; // seconds
  
  bgmGain = audioCtx.createGain();
  bgmGain.gain.value = 0.08;
  
  for (let i = 0; i < pattern.length; i++) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.value = pattern[i].note;
    
    g.gain.setValueAtTime(0, audioCtx.currentTime + pattern[i].time - 0.1);
    g.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + pattern[i].time);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + pattern[i].time + 0.4);
    
    osc.connect(g);
    g.connect(bgmGain);
    
    osc.start(audioCtx.currentTime + pattern[i].time - 0.1);
    osc.stop(audioCtx.currentTime + pattern[i].time + 0.5);
    
    bgmOscillators.push({ osc, gain: g });
  }
  
  bgmEnabled = true;
}

function stopBackgroundMusic() {
  ensureAudioContext();
  
  for (const { osc, gain } of bgmOscillators) {
    try {
      osc.stop(audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
    } catch(e) {}
  }
  
  bgmOscillators = [];
  bgmEnabled = false;
}

// --- Volume Control ---

let volumeLevel = 0.5;

function setVolume(level) {
  const clamped = Math.max(0, Math.min(1, level));
  volumeLevel = clamped;
  
  if (bgmGain) {
    bgmGain.gain.value = volumeLevel * 0.2;
  }
}

// --- Master Volume Getter ---

function getVolume() {
  return volumeLevel;
}

export {
  playTone,
  playNoise,
  playAlienShoot,
  playPlayerShoot,
  playAlienDeath,
  playPlayerHit,
  playWaveStart,
  playGameOver,
  startBackgroundMusic,
  stopBackgroundMusic,
  setVolume,
  getVolume,
};
