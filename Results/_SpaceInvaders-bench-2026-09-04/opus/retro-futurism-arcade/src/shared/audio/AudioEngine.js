/**
 * Web Audio session engine.
 *
 * ### The autoplay gate
 *
 * Every browser starts an `AudioContext` in the `suspended` state and refuses
 * to resume it outside a user-gesture handler. This is not negotiable and it is
 * the single most common reason a browser game ships with no sound. The engine
 * therefore does **not** create the context at construction — it creates and
 * resumes it inside the first real input event, and everything that wants to
 * make noise before then is silently discarded rather than throwing.
 *
 * ### The bus
 *
 *     voices ──┬─> dryGain ─────────────┐
 *              └─> reverbSend ─> convolver ─> wetGain ─┤
 *                                                      ├─> master ─> compressor ─> out
 *                                       musicGain ─────┘
 *
 * The compressor on the master bus is doing real work, not decoration. A
 * synthesised arcade mix has extremely wide dynamic range — a 72-particle death
 * explosion and a single UI blip differ by 30dB — and without limiting, the loud
 * events clip audibly. Compression also glues simultaneous events together so
 * that eight overlapping impacts sound like one big impact rather than eight.
 *
 * ### Impulse response
 *
 * The reverb IR is generated procedurally: exponentially decaying noise, which
 * is a crude but entirely convincing model of a diffuse room. No files.
 */
export class AudioEngine {
  constructor({ masterVolume = 0.7, reverbSeconds = 1.4, reverbDecay = 2.6 } = {}) {
    /** @type {AudioContext|null} */
    this.ctx = null;

    this.masterVolume = masterVolume;
    this.reverbSeconds = reverbSeconds;
    this.reverbDecay = reverbDecay;

    this.master = null;
    this.compressor = null;
    this.dry = null;
    this.wet = null;
    this.convolver = null;
    this.sfxBus = null;
    this.musicBus = null;

    this.ready = false;
    this.muted = false;
    /** Set true once the user gesture has unlocked audio. */
    this.unlocked = false;

    this._noiseBuffer = null;
    this._unlockHandler = null;
  }

  /**
   * Create the context and graph. Must be called from inside a user-gesture
   * handler; calling it anywhere else produces a context that never leaves
   * `suspended`.
   */
  init() {
    if (this.ctx) {
      this.resume();
      return this.ctx;
    }

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      console.warn('AudioEngine: Web Audio is unavailable; running silent.');
      return null;
    }

    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;

    // --- Master chain -----------------------------------------------------
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 22;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;
    this.compressor.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = this.masterVolume;
    this.master.connect(this.compressor);

    // --- Reverb -----------------------------------------------------------
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this._makeImpulseResponse(this.reverbSeconds, this.reverbDecay);

    this.wet = ctx.createGain();
    this.wet.gain.value = 0.22;
    this.convolver.connect(this.wet);
    this.wet.connect(this.master);

    this.dry = ctx.createGain();
    this.dry.gain.value = 1.0;
    this.dry.connect(this.master);

    // --- Buses ------------------------------------------------------------
    // SFX feed both dry and reverb; music stays dry so the arpeggios keep their
    // definition and do not turn to mush behind a busy wave.
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.dry);
    this.sfxBus.connect(this.convolver);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.musicBus.connect(this.dry);

    this._noiseBuffer = this._makeNoiseBuffer(2.0);

    this.ready = true;
    this.resume();
    return ctx;
  }

  /**
   * Install one-shot unlock listeners on the common gesture events.
   * @returns {() => void} teardown
   */
  installUnlockHandlers(target = window) {
    if (this._unlockHandler) return () => {};

    const events = ['pointerdown', 'keydown', 'touchstart'];
    const handler = () => {
      this.init();
      this.unlocked = true;
      for (const type of events) target.removeEventListener(type, handler);
      this._unlockHandler = null;
    };

    this._unlockHandler = handler;
    for (const type of events) {
      target.addEventListener(type, handler, { passive: true });
    }

    return () => {
      for (const type of events) target.removeEventListener(type, handler);
      this._unlockHandler = null;
    };
  }

  /** Resume a suspended context. Safe to call repeatedly. */
  resume() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        /* still gated; will retry on the next gesture */
      });
    }
  }

  /**
   * Suspend the context, releasing the audio hardware.
   *
   * Called when the tab is hidden. A game that keeps its context running in a
   * background tab holds an audio device open and drains battery for a page
   * nobody is looking at.
   */
  suspend() {
    if (!this.ctx) return;
    if (this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  /** Current context time, or 0 before initialisation. */
  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** True when it is safe to schedule sound. */
  get available() {
    return this.ready && this.ctx !== null && this.ctx.state !== 'closed';
  }

  /** A shared buffer of white noise, used by every noise-based voice. */
  get noiseBuffer() {
    return this._noiseBuffer;
  }

  /** Master volume, 0..1. */
  setMasterVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, value));
    if (this.master) {
      // Ramp rather than set: an instantaneous gain change on a running signal
      // is a discontinuity, which is audible as a click.
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, this.now, 0.02);
    }
  }

  setMusicVolume(value) {
    if (this.musicBus) {
      this.musicBus.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.now, 0.05);
    }
  }

  setSfxVolume(value) {
    if (this.sfxBus) {
      this.sfxBus.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.now, 0.02);
    }
  }

  /** Reverb send level, 0..1. */
  setReverb(value) {
    if (this.wet) {
      this.wet.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.now, 0.1);
    }
  }

  /** Mute without tearing anything down. */
  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.masterVolume, this.now, 0.02);
    }
  }

  /**
   * Generate a decaying-noise impulse response.
   *
   * `noise * (1 - t)^decay` per sample, stereo-decorrelated. The exponent
   * controls how quickly the tail dies: 2.6 gives a tight, metallic room that
   * suits a space arena, where a lower value would give a cathedral.
   */
  _makeImpulseResponse(seconds, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buffer = ctx.createBuffer(2, length, rate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        // Independent noise per channel is what gives the reverb width.
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buffer;
  }

  /** A reusable buffer of white noise. */
  _makeNoiseBuffer(seconds) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buffer = ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Close the context and release the audio device.
   *
   * Only called on full page teardown. Switching games suspends rather than
   * closes, because a closed `AudioContext` cannot be reopened and every
   * browser limits how many a page may create.
   */
  dispose() {
    if (this._unlockHandler) {
      for (const type of ['pointerdown', 'keydown', 'touchstart']) {
        window.removeEventListener(type, this._unlockHandler);
      }
      this._unlockHandler = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.ready = false;
  }
}
