import { tone, noiseBurst } from './Synth.js';

/**
 * Generative music scheduler.
 *
 * ### Why a lookahead scheduler rather than `setInterval`
 *
 * Musical timing cannot be driven from `requestAnimationFrame` or
 * `setInterval`. Both are main-thread timers with jitter measured in whole
 * milliseconds, and the ear detects rhythmic jitter above roughly 2ms — a
 * sequencer built on frame callbacks audibly wobbles, and it drifts further
 * whenever the frame rate dips, which is exactly when the game is most intense.
 *
 * The standard solution, used here: run a coarse frame-rate check that looks
 * ahead a fixed window and schedules every note falling inside it at an
 * *exact* `AudioContext` time. The audio thread then plays them with
 * sample-accurate timing regardless of what the main thread is doing. Notes are
 * scheduled ahead of time; only the decision to schedule is frame-driven.
 *
 * ### Tempo as a gameplay variable
 *
 * `stepPeriod` is settable per note. In Space Invaders it is wired directly to
 * the invader formation's march period, so the music accelerates as the player
 * kills — not because anything ramps it, but because it is literally the same
 * number. The 1978 original got that effect by accident of its CPU budget; here
 * it is deliberate, and it is the reason the soundtrack always matches the
 * tension exactly.
 */
export class MusicDirector {
  /**
   * @param {import('./AudioEngine.js').AudioEngine} engine
   * @param {object} [opts]
   */
  constructor(engine, opts = {}) {
    const {
      pattern = [0, -2, -4, -5],
      rootFreq = 110,
      lookahead = 0.25,
      stepPeriod = 0.6,
      swing = 0
    } = opts;

    this.engine = engine;
    /** Semitone offsets from the root, one per step. */
    this.pattern = pattern;
    this.rootFreq = rootFreq;
    this.lookahead = lookahead;
    this.stepPeriod = stepPeriod;
    this.swing = swing;

    this.playing = false;
    this.stepIndex = 0;
    /** Audio-clock time of the next note. */
    this.nextNoteTime = 0;

    /**
     * 0..1 tension value. Drives layer gating and filter brightness. Set from
     * gameplay — in Space Invaders, `1 - alive/total`.
     */
    this.intensity = 0;

    /** Layer enables, recomputed from intensity each step. */
    this.layers = { bass: true, sub: true, hat: false, pad: false };

    /** Master gain scaler applied to every voice this director creates. */
    this.gain = 1;
  }

  /** Convert a semitone offset to a frequency multiplier. */
  static semitone(n) {
    return Math.pow(2, n / 12);
  }

  /**
   * Set the note duration. This is the tempo control.
   *
   * Clamped at the bottom because the formation step period drops to 55ms at
   * one surviving invader, and notes shorter than about 45ms stop reading as
   * pitched events and start reading as clicks.
   */
  setStepPeriod(seconds) {
    this.stepPeriod = Math.max(0.045, seconds);
  }

  /** Set the tension level, 0..1. */
  setIntensity(value) {
    this.intensity = value < 0 ? 0 : value > 1 ? 1 : value;
  }

  /** Overall volume scaler for this director's voices. */
  setGain(value) {
    this.gain = Math.max(0, value);
  }

  start() {
    if (this.playing) return;
    const ctx = this.engine.ctx;
    if (!ctx) return;
    this.playing = true;
    this.stepIndex = 0;
    // Small offset so the first note is scheduled in the future rather than in
    // the past, which some implementations drop entirely.
    this.nextNoteTime = ctx.currentTime + 0.06;
  }

  stop() {
    this.playing = false;
  }

  /**
   * Frame tick. Schedules every note that falls inside the lookahead window.
   *
   * The `while` loop is essential rather than an `if`: at high tempo several
   * notes can fall inside one lookahead window, and at low frame rates the
   * window may be crossed by more than one note per frame. Scheduling only one
   * would make the sequencer silently drop notes exactly when the game speeds
   * up.
   */
  update() {
    if (!this.playing) return;
    const ctx = this.engine.ctx;
    if (!ctx || !this.engine.available) return;

    const horizon = ctx.currentTime + this.lookahead;
    let guard = 0;

    while (this.nextNoteTime < horizon && guard < 64) {
      this._scheduleStep(this.stepIndex, this.nextNoteTime);

      // Swing: delay every second note by a fraction of the step. Zero by
      // default — a marching formation should be metronomic.
      const swingOffset = this.stepIndex % 2 === 1 ? this.stepPeriod * this.swing : 0;
      this.nextNoteTime += this.stepPeriod + swingOffset;
      this.stepIndex++;
      guard++;
    }

    // If the audio clock has run far ahead of us (tab was backgrounded, the
    // context was suspended), resync rather than frantically scheduling
    // hundreds of notes that are already in the past.
    if (this.nextNoteTime < ctx.currentTime - 0.5) {
      this.nextNoteTime = ctx.currentTime + 0.05;
    }
  }

  /** Recompute which layers are active for the current intensity. */
  _updateLayers() {
    this.layers.bass = true;
    this.layers.sub = true;
    this.layers.hat = this.intensity > 0.3;
    this.layers.pad = this.intensity > 0.55;
  }

  /**
   * Emit one step of the arrangement at an exact audio time.
   * @param {number} index monotonically increasing step counter
   * @param {number} when audio-clock time
   */
  _scheduleStep(index, when) {
    this._updateLayers();

    const engine = this.engine;
    const dest = engine.musicBus;
    if (!dest) return;

    const step = index % this.pattern.length;
    const semis = this.pattern[step];
    const freq = this.rootFreq * MusicDirector.semitone(semis);

    // Note length is a fraction of the step so successive notes never overlap
    // into a drone, which is what happens if you simply use `stepPeriod`.
    const noteLength = Math.min(this.stepPeriod * 0.78, 0.34);

    // --- Bass: the four-note motif ---------------------------------------
    if (this.layers.bass) {
      // Filter cutoff opens with intensity: the same notes get progressively
      // more aggressive as the wave thins out, without changing the melody.
      const cutoff = 420 + 2200 * this.intensity;
      tone(engine, {
        type: 'square',
        freqStart: freq,
        freqEnd: freq * 0.985,
        duration: noteLength,
        gain: 0.13 * this.gain,
        attack: 0.004,
        decay: noteLength * 0.4,
        sustain: 0.45,
        release: noteLength * 0.5,
        filterType: 'lowpass',
        filterStart: cutoff,
        filterQ: 3.5,
        destination: dest,
        when
      });
    }

    // --- Sub: an octave below, sine, for weight on a phone speaker ------
    if (this.layers.sub) {
      tone(engine, {
        type: 'sine',
        freqStart: freq * 0.5,
        freqEnd: freq * 0.5,
        duration: noteLength * 0.9,
        gain: 0.1 * this.gain,
        attack: 0.006,
        decay: noteLength * 0.3,
        sustain: 0.5,
        release: noteLength * 0.4,
        destination: dest,
        when
      });
    }

    // --- Hat: off-beat noise, appears as tension rises -------------------
    if (this.layers.hat && this.stepPeriod > 0.09) {
      noiseBurst(engine, {
        duration: 0.03,
        gain: 0.05 * this.gain * this.intensity,
        attack: 0.001,
        decay: 0.012,
        release: 0.02,
        filterType: 'highpass',
        filterStart: 6500,
        filterQ: 0.8,
        destination: dest,
        when: when + this.stepPeriod * 0.5
      });
    }

    // --- Pad: a sustained fifth, only at high tension --------------------
    // Held for four steps and retriggered on the downbeat, so it reads as a
    // drone under the motif rather than as a fifth voice in the melody.
    if (this.layers.pad && step === 0) {
      const padLength = this.stepPeriod * 4;
      tone(engine, {
        type: 'triangle',
        freqStart: freq * 3, // an octave and a fifth up
        freqEnd: freq * 3,
        duration: padLength,
        gain: 0.045 * this.gain * this.intensity,
        attack: padLength * 0.25,
        decay: padLength * 0.2,
        sustain: 0.7,
        release: padLength * 0.4,
        filterType: 'lowpass',
        filterStart: 1400 + 1800 * this.intensity,
        filterQ: 1.2,
        destination: dest,
        when
      });
    }
  }

  /**
   * A one-shot low drone, used for the silence after the player dies. Not part
   * of the sequence — it deliberately has no tempo, because the absence of the
   * march is the point.
   */
  playMourningDrone(seconds = 2.4) {
    const engine = this.engine;
    if (!engine.ctx) return;
    tone(engine, {
      type: 'sine',
      freqStart: this.rootFreq * 0.5,
      freqEnd: this.rootFreq * 0.47,
      duration: seconds,
      gain: 0.1 * this.gain,
      attack: 0.35,
      decay: 0.5,
      sustain: 0.6,
      release: 0.9,
      filterType: 'lowpass',
      filterStart: 320,
      filterQ: 1.1,
      destination: engine.musicBus
    });
  }

  /** Reset the sequence to the start of the pattern. */
  reset() {
    this.stepIndex = 0;
    if (this.engine.ctx) {
      this.nextNoteTime = this.engine.ctx.currentTime + 0.06;
    }
  }
}
