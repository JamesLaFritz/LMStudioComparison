/**
 * SoundManager - Web Audio API synthesized sound effects and music.
 * All audio is procedurally generated — no external assets needed.
 */

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.musicPlaying = false;
    this.musicOscillators = [];
    this.musicFilters = [];
    this.musicLooping = false;
  }

  /**
   * Initialize audio context (must be called after user interaction).
   */
  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.3; // Master volume
      this.masterGain.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Play a synthesized sound effect.
   */
  playEffect(effectName) {
    if (!this.audioCtx || this.audioCtx.state === 'suspended') return;

    const now = this.audioCtx.currentTime;

    switch (effectName) {
      case 'shoot':
        this._playShoot(now);
        break;
      case 'explosion':
        this._playExplosion(now, 0.5);
        break;
      case 'enemyFire':
        this._playEnemyFire(now);
        break;
      case 'powerup':
        this._playPowerUp(now);
        break;
      case 'playerDeath':
        this._playPlayerDeath(now);
        break;
      case 'alienHit':
        this._playAlienHit(now, 0.3);
        break;
    }
  }

  /**
   * Player shot: White noise burst + descending sine sweep.
   */
  _playShoot(now) {
    // Noise burst
    const bufferSize = this.audioCtx.sampleRate * 0.015;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 800;

    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSource.start(now);
    noiseSource.stop(now + 0.02);

    // Sine sweep (descending)
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.015);

    const sweepGain = this.audioCtx.createGain();
    sweepGain.gain.setValueAtTime(0.08, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    osc.connect(sweepGain);
    sweepGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.02);
  }

  /**
   * Explosion: Noise burst + descending sine sweep with rumble.
   */
  _playExplosion(now, duration = 0.5) {
    // Long noise burst
    const bufferSize = this.audioCtx.sampleRate * duration;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const lowPassFilter = this.audioCtx.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.setValueAtTime(2000, now);
    lowPassFilter.frequency.exponentialRampToValueAtTime(100, now + duration);

    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(lowPassFilter);
    lowPassFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSource.start(now);
    noiseSource.stop(now + duration + 0.1);

    // Rumble (low frequency sine)
    const rumbleOsc = this.audioCtx.createOscillator();
    rumbleOsc.type = 'sawtooth';
    rumbleOsc.frequency.setValueAtTime(80, now);
    rumbleOsc.frequency.exponentialRampToValueAtTime(20, now + duration);

    const rumbleGain = this.audioCtx.createGain();
    rumbleGain.gain.setValueAtTime(0.15, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumbleOsc.start(now);
    rumbleOsc.stop(now + duration + 0.2);
  }

  /**
   * Enemy fire: Short square wave tick.
   */
  _playEnemyFire(now) {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.005);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.01);
  }

  /**
   * Power-up pickup: Ascending arpeggio (3 notes).
   */
  _playPowerUp(now) {
    const notes = [523.25, 659.25, 783.99]; // C5 - E5 - G5

    for (let i = 0; i < notes.length; i++) {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], now + i * 0.1);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.4);
    }
  }

  /**
   * Player death: Extended noise sweep + low-frequency rumble.
   */
  _playPlayerDeath(now) {
    // Long noise burst
    const bufferSize = this.audioCtx.sampleRate * 1.0;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const lowPassFilter = this.audioCtx.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.setValueAtTime(3000, now);
    lowPassFilter.frequency.exponentialRampToValueAtTime(50, now + 1.0);

    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    noiseSource.connect(lowPassFilter);
    lowPassFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSource.start(now);
    noiseSource.stop(now + 1.5);

    // Rumble
    const rumbleOsc = this.audioCtx.createOscillator();
    rumbleOsc.type = 'sawtooth';
    rumbleOsc.frequency.setValueAtTime(200, now);
    rumbleOsc.frequency.exponentialRampToValueAtTime(30, now + 1.0);

    const rumbleGain = this.audioCtx.createGain();
    rumbleGain.gain.setValueAtTime(0.25, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumbleOsc.start(now);
    rumbleOsc.stop(now + 1.5);
  }

  /**
   * Alien hit: Noise burst + descending sine (short).
   */
  _playAlienHit(now, duration = 0.3) {
    const bufferSize = this.audioCtx.sampleRate * duration;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const lowPassFilter = this.audioCtx.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.setValueAtTime(2000, now);
    lowPassFilter.frequency.exponentialRampToValueAtTime(500, now + duration);

    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(lowPassFilter);
    lowPassFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSource.start(now);
    noiseSource.stop(now + duration + 0.1);
  }

  /**
   * Start procedural background music loop.
   */
  startMusic() {
    if (!this.audioCtx || this.audioCtx.state === 'suspended') return;
    if (this.musicPlaying) return;

    this.musicPlaying = true;
    this._startMusicLoop();
  }

  /**
   * Stop background music.
   */
  stopMusic() {
    this.musicPlaying = false;
    for (const osc of this.musicOscillators) {
      try { osc.stop(); } catch (e) {}
    }
    this.musicOscillators = [];
    this.musicFilters = [];
  }

  /**
   * Start the procedural synth music loop.
   */
  _startMusicLoop() {
    // Bass line — alternating square waves
    const bassOsc1 = this.audioCtx.createOscillator();
    bassOsc1.type = 'square';
    bassOsc1.frequency.value = 80;

    const bassOsc2 = this.audioCtx.createOscillator();
    bassOsc2.type = 'square';
    bassOsc2.frequency.value = 65.41; // A2

    const bassFilter = this.audioCtx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 300;
    bassFilter.Q.value = 5;

    const bassGain = this.audioCtx.createGain();
    bassGain.gain.value = 0.12;

    bassOsc1.connect(bassFilter);
    bassOsc2.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.masterGain);

    bassOsc1.start();
    bassOsc2.start();
    this.musicOscillators.push(bassOsc1, bassOsc2);
    this.musicFilters.push(bassFilter);

    // Arpeggiated melody line
    const melodyNotes = [
      { freq: 523.25, time: 0 },   // C4
      { freq: 659.25, time: 1 },   // E4
      { freq: 783.99, time: 2 },   // G4
      { freq: 523.25, time: 3 }    // C4
    ];

    const melodyOsc = this.audioCtx.createOscillator();
    melodyOsc.type = 'sine';
    melodyOsc.frequency.value = melodyNotes[0].freq;

    const melodyFilter = this.audioCtx.createBiquadFilter();
    melodyFilter.type = 'lowpass';
    melodyFilter.frequency.value = 2000;

    const melodyGain = this.audioCtx.createGain();
    melodyGain.gain.value = 0.06;

    melodyOsc.connect(melodyFilter);
    melodyFilter.connect(melodyGain);
    melodyGain.connect(this.masterGain);
    melodyOsc.start();
    this.musicOscillators.push(melodyOsc);
    this.musicFilters.push(melodyFilter);

    // Arpeggiate the melody every 4 beats (1 second at 60 BPM)
    const loopInterval = 250; // ms per note
    let noteIndex = 0;

    const arpeggiate = () => {
      if (!this.musicPlaying) return;

      const note = melodyNotes[noteIndex % melodyNotes.length];
      melodyOsc.frequency.setValueAtTime(note.freq, this.audioCtx.currentTime);

      // Fade out current note and fade in new one
      melodyGain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);
      setTimeout(() => {
        melodyGain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
      }, 50);

      noteIndex++;
      requestAnimationFrame(arpeggiate);
    };

    arpeggiate();
  }

  /**
   * Dispose all audio resources.
   */
  dispose() {
    if (this.musicPlaying) this.stopMusic();
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch (e) {}
      this.audioCtx = null;
    }
  }
}

export default SoundManager;