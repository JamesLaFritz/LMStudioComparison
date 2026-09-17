/**
 * Thin wrapper around a single Web Audio context + master bus.
 * All SFX/music in this project are synthesized at runtime — no .mp3/.wav assets.
 */
export class AudioEngine {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._compressor = null;
    this._unlocked = false;
  }

  _ensureContext() {
    if (this._ctx) return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    this._ctx = new AudioContextCtor();
    this._compressor = this._ctx.createDynamicsCompressor();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 0.6;
    this._masterGain.connect(this._compressor);
    this._compressor.connect(this._ctx.destination);
  }

  /** Must be called from a user gesture (click/keydown) to satisfy autoplay policy. */
  unlock() {
    this._ensureContext();
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    this._unlocked = true;
  }

  get context() {
    this._ensureContext();
    return this._ctx;
  }

  get destination() {
    this._ensureContext();
    return this._masterGain;
  }

  get now() {
    this._ensureContext();
    return this._ctx.currentTime;
  }

  get isUnlocked() {
    return this._unlocked;
  }

  setMasterVolume(value) {
    this._ensureContext();
    this._masterGain.gain.value = value;
  }
}
