export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicNodes = [];
    this.initialized = false;
    this.volume = 0.5;
    this.musicVolume = 0.3;
    this.sfxVolume = 0.6;
  }

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    this.initialized = true;
  }

  setVolume(v) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  playTone(freq, type = 'square', duration = 0.1, vol = 0.3) {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playNoise(duration = 0.1, vol = 0.2) {
    if (!this.initialized) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start();
  }

  playSweep(fromFreq, toFreq, duration = 0.2, vol = 0.2) {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(fromFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(toFreq, 1), this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  startMusic(pattern) {
    if (!this.initialized) return;
    this.stopMusic();
    if (!pattern || !pattern.notes || pattern.notes.length === 0) return;
    const bpm = pattern.bpm || 120;
    const beatDur = 60 / bpm;
    const loopDur = pattern.notes.length * beatDur;
    const now = this.ctx.currentTime;
    const loop = () => {
      if (!this.initialized) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < pattern.notes.length; i++) {
        const note = pattern.notes[i];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = pattern.waveType || 'square';
        osc.frequency.value = note;
        const startTime = t + i * beatDur;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + beatDur * 0.9);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(startTime);
        osc.stop(startTime + beatDur);
        this.musicNodes.push(osc);
      }
      this._musicTimer = setTimeout(loop, loopDur * 1000 - 50);
    };
    loop();
  }

  stopMusic() {
    if (this._musicTimer) clearTimeout(this._musicTimer);
    this.musicNodes.forEach(n => { try { n.stop(); } catch(e) {} });
    this.musicNodes = [];
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
    this.initialized = false;
  }
}
