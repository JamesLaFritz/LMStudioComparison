/**
 * AudioManager — Web Audio API synthesized SFX and procedural music bed.
 * No external audio files. All sounds generated via oscillators and noise buffers.
 */

const SFX_DEFS = {
  playerShoot:   { type: 'square', freq: 880, duration: 0.08, decay: 0.06, vol: 0.25 },
  invaderShoot:  { type: 'sawtooth', freq: 150, duration: 0.15, decay: 0.12, vol: 0.15 },
  invaderKill:   { type: 'noise', duration: 0.25, vol: 0.3 },
  playerHit:     { type: 'rumble', duration: 0.4, vol: 0.35 },
  mysteryKill:   { type: 'arpeggio', duration: 0.6, vol: 0.3 },
  shieldErode:   { type: 'click', duration: 0.05, vol: 0.15 },
  waveClear:     { type: 'fanfare', duration: 0.8, vol: 0.3 },
  gameOver:      { type: 'descend', duration: 1.2, vol: 0.35 },
  invaderStep:   { type: 'tick', duration: 0.03, vol: 0.1 },
  mysteryAppear: { type: 'warble', duration: 0.5, vol: 0.2 },
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicPlaying = false;
    this.musicNodes = [];
    this.waveNumber = 1;
    this.volume = 0.3;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1.0;
    this.sfxGain.connect(this.masterGain);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }

  setWave(w) {
    this.waveNumber = w;
  }

  // --- SFX ---

  playSFX(type, pitch = 1.0) {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const def = SFX_DEFS[type];
    if (!def) return;
    const t = this.ctx.currentTime;

    switch (def.type) {
      case 'square':
      case 'sawtooth': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = def.type;
        osc.frequency.value = def.freq * pitch;
        gain.gain.setValueAtTime(def.vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + def.duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + def.duration);
        break;
      }
      case 'noise': {
        const bufferSize = this.ctx.sampleRate * def.duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(def.vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + def.duration);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000 * pitch, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + def.duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        source.start(t);
        break;
      }
      case 'rumble': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 60;
        gain.gain.setValueAtTime(def.vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + def.duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + def.duration);
        // Add noise layer
        const bufSize = this.ctx.sampleRate * def.duration;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const ns = this.ctx.createBufferSource();
        ns.buffer = buf;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(def.vol * 0.5, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + def.duration * 0.7);
        const nf = this.ctx.createBiquadFilter();
        nf.type = 'lowpass';
        nf.frequency.value = 300;
        ns.connect(nf);
        nf.connect(ng);
        ng.connect(this.sfxGain);
        ns.start(t);
        break;
      }
      case 'arpeggio': {
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
        const noteLen = def.duration / notes.length;
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = freq * pitch;
          gain.gain.setValueAtTime(0, t + i * noteLen);
          gain.gain.linearRampToValueAtTime(def.vol * 0.4, t + i * noteLen + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + i * noteLen + noteLen);
          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(t + i * noteLen);
          osc.stop(t + i * noteLen + noteLen + 0.05);
        });
        break;
      }
      case 'click': {
        const bufSize = this.ctx.sampleRate * def.duration;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource();
        source.buffer = buf;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(def.vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + def.duration);
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 4000;
        source.connect(f);
        f.connect(gain);
        gain.connect(this.sfxGain);
        source.start(t);
        break;
      }
      case 'fanfare': {
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        const noteLen = def.duration / notes.length;
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, t + i * noteLen);
          gain.gain.linearRampToValueAtTime(def.vol * 0.3, t + i * noteLen + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + i * noteLen + noteLen * 0.9);
          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(t + i * noteLen);
          osc.stop(t + i * noteLen + noteLen + 0.05);
        });
        break;
      }
      case 'descend': {
        const notes = [523.25, 493.88, 440.00, 392.00, 349.23, 329.63, 293.66, 261.63];
        const noteLen = def.duration / notes.length;
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, t + i * noteLen);
          gain.gain.linearRampToValueAtTime(def.vol * 0.25, t + i * noteLen + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + i * noteLen + noteLen * 0.9);
          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(t + i * noteLen);
          osc.stop(t + i * noteLen + noteLen + 0.05);
        });
        break;
      }
      case 'tick': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 1200 * pitch;
        gain.gain.setValueAtTime(def.vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + def.duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + def.duration + 0.01);
        break;
      }
      case 'warble': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 440;
        lfo.type = 'sine';
        lfo.frequency.value = 8;
        lfoGain.gain.value = 100;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(def.vol, t + 0.1);
        gain.gain.setValueAtTime(def.vol, t + def.duration * 0.7);
        gain.gain.linearRampToValueAtTime(0.001, t + def.duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        lfo.start(t);
        osc.stop(t + def.duration + 0.05);
        lfo.stop(t + def.duration + 0.05);
        break;
      }
    }
  }

  // --- Music Bed ---

  startMusic() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this._scheduleMusic();
  }

  stopMusic() {
    this.musicPlaying = false;
    this.musicNodes.forEach(node => {
      try { node.stop(); } catch (_) {}
      try { node.disconnect(); } catch (_) {}
    });
    this.musicNodes = [];
  }

  _scheduleMusic() {
    if (!this.musicPlaying || !this.ctx) return;
    const t = this.ctx.currentTime;
    const bpm = 120 + (this.waveNumber - 1) * 10;
    const beatDur = 60 / bpm;
    const loopBeats = 16;
    const loopDur = loopBeats * beatDur;

    // Bass drone
    const drone = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    const droneFilter = this.ctx.createBiquadFilter();
    drone.type = 'sine';
    drone.frequency.value = 55;
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 120;
    droneGain.gain.setValueAtTime(0.15, t);
    droneGain.gain.setValueAtTime(0.15, t + loopDur - 0.1);
    droneGain.gain.linearRampToValueAtTime(0, t + loopDur);
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.musicGain);
    drone.start(t);
    drone.stop(t + loopDur);
    this.musicNodes.push(drone);

    // Arpeggio — phrygian mode
    const phrygian = [130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94];
    for (let i = 0; i < loopBeats; i++) {
      const noteTime = t + i * beatDur;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      const noteIdx = i % phrygian.length;
      const octave = i < 8 ? 1 : 2;
      osc.frequency.value = phrygian[noteIdx] * octave;
      gain.gain.setValueAtTime(0.06, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + beatDur * 0.8);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(noteTime);
      osc.stop(noteTime + beatDur);
      this.musicNodes.push(osc);
    }

    // Hi-hat on every other beat
    for (let i = 0; i < loopBeats; i += 2) {
      const noteTime = t + i * beatDur;
      const bufSize = this.ctx.sampleRate * beatDur * 0.3;
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < bufSize; j++) d[j] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.04, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + beatDur * 0.3);
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 8000;
      src.connect(f);
      f.connect(gain);
      gain.connect(this.musicGain);
      src.start(noteTime);
    }

    // Schedule next loop
    setTimeout(() => this._scheduleMusic(), loopDur * 1000 - 100);
  }
}
