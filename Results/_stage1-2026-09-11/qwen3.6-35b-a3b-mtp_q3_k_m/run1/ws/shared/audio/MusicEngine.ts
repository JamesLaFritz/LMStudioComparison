/**
 * Procedural music engine using Web Audio API oscillators.
 * Generates a looping retro-futuristic soundtrack with no external audio files.
 */

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private intervalId: number | null = null;
  private intensity: number = 0.5; // 0-1, affects note density and volume

  constructor() {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.12;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API not available for music:', e);
    }
  }

  private ensureContext(): boolean {
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return true;
  }

  /** Start the procedural music loop */
  start(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    if (this.isPlaying) return;
    this.isPlaying = true;

    const bpm = 120;
    const beatInterval = 60 / bpm; // seconds per beat

    // Bass line pattern — pentatonic scale notes
    const bassNotes = [65.41, 77.78, 98.00, 110.00, 130.81]; // C2, D2, F2, G2, A2

    // Arpeggio pattern — higher octave
    const arpNotes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5

    let beatCount = 0;
    let arpIndex = 0;

    const playBeat = () => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;

      const now = this.ctx.currentTime;

      // Bass on every other beat
      if (beatCount % 2 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'square';
        const noteIdx = Math.floor(beatCount / 4) % bassNotes.length;
        bassOsc.frequency.setValueAtTime(bassNotes[noteIdx], now);
        bassGain.gain.setValueAtTime(0.15 * this.intensity, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + beatInterval * 1.8);
        bassOsc.connect(bassGain);
        bassGain.connect(this.masterGain);
        bassOsc.start(now);
        bassOsc.stop(now + beatInterval * 2);
      }

      // Arpeggio on every beat with intensity-based probability
      if (Math.random() < this.intensity) {
        const arpOsc = this.ctx.createOscillator();
        const arpGain = this.ctx.createGain();
        arpOsc.type = 'sawtooth';
        const noteIdx = arpIndex % arpNotes.length;
        arpOsc.frequency.setValueAtTime(arpNotes[noteIdx], now);
        arpGain.gain.setValueAtTime(0.06 * this.intensity, now);
        arpGain.gain.exponentialRampToValueAtTime(0.001, now + beatInterval * 0.8);
        arpOsc.connect(arpGain);
        arpGain.connect(this.masterGain);
        arpOsc.start(now);
        arpOsc.stop(now + beatInterval);

        arpIndex++;
      }

      // Percussion — noise burst on beats 1 and 3
      if (beatCount % 4 === 0 || beatCount % 4 === 2) {
        this.playPercussion(now, beatCount % 4 === 0 ? 'kick' : 'hihat');
      }

      // Hi-hat on off-beats at higher intensity
      if (this.intensity > 0.7 && beatCount % 2 === 1) {
        this.playPercussion(now, 'hihat');
      }

      beatCount++;
    };

    playBeat(); // Play first beat immediately
    this.intervalId = window.setInterval(playBeat, beatInterval * 1000);
  }

  private playPercussion(time: number, type: 'kick' | 'hihat'): void {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      if (type === 'kick') {
        // Low-frequency noise burst for kick
        const freq = 60 * Math.exp(-i / (this.ctx.sampleRate * 0.02));
        data[i] = Math.sin(2 * Math.PI * freq * i / this.ctx.sampleRate) *
                  Math.pow(1 - i / bufferSize, 3);
      } else {
        // High-frequency noise for hi-hat
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 6);
      }
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    if (type === 'kick') {
      gain.gain.setValueAtTime(0.2 * this.intensity, time);
    } else {
      gain.gain.setValueAtTime(0.08 * this.intensity, time);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(time);
  }

  /** Stop the music */
  stop(): void {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Set intensity level (0-1). Higher = more notes, louder. */
  setIntensity(level: number): void {
    this.intensity = Math.max(0, Math.min(1, level));
    if (this.masterGain) {
      this.masterGain.gain.value = 0.12 * (0.5 + this.intensity * 0.5);
    }
  }

  /** Get current intensity */
  getIntensity(): number {
    return this.intensity;
  }

  /** Reset audio context for reuse */
  reset(): void {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
